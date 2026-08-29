import { randomUUID } from "node:crypto";
import type { Layer, LayerInput, LayerPatch } from "@maptoy/contracts";
import type {
  LayerPluginDefinition,
  LayerPluginRegistry,
} from "@maptoy/layer-plugin-sdk";
import type { LayerRepository } from "./repository.js";

export class LayerNotFoundError extends Error {
  readonly code = "LAYER_NOT_FOUND";
  readonly statusCode = 404;

  constructor() {
    super("The requested layer does not exist.");
    this.name = "LayerNotFoundError";
  }
}

export class LayerValidationError extends Error {
  readonly code = "LAYER_INVALID";
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "LayerValidationError";
  }
}

function inputFromLayer(layer: Layer): LayerInput {
  return {
    name: layer.name,
    pluginId: layer.pluginId,
    configuration: layer.configuration,
    data: layer.data,
    visible: layer.visible,
    displayOrder: layer.displayOrder,
    opacity: layer.opacity,
    minimumZoom: layer.minimumZoom,
    maximumZoom: layer.maximumZoom,
  };
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new LayerValidationError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function normalizeLayerName(name: string): string {
  const segments = name.split("/").map((segment) => segment.trim());
  if (segments.some((segment) => segment.length === 0)) {
    throw new LayerValidationError(
      "Layer names must contain non-empty path segments separated by /.",
    );
  }
  return segments.join("/");
}

export class LayerService {
  constructor(
    private readonly repository: LayerRepository,
    private readonly plugins: LayerPluginRegistry,
  ) {}

  async initialize(): Promise<void> {
    for (const layer of this.repository.list()) {
      await this.reconcile(layer);
    }
  }

  list(): Layer[] {
    return this.repository
      .list()
      .map((layer) => this.withEffectiveStatus(layer));
  }

  get(id: string): Layer {
    const layer = this.repository.get(id);
    if (layer === undefined) {
      throw new LayerNotFoundError();
    }
    return this.withEffectiveStatus(layer);
  }

  async create(input: LayerInput): Promise<Layer> {
    const plugin = this.requirePlugin(input.pluginId);
    const normalized = await this.validateInput(input, plugin);
    const timestamp = new Date().toISOString();
    const layer: Layer = {
      ...normalized,
      id: randomUUID(),
      pluginVersion: plugin.manifest.version,
      schemaVersion: plugin.manifest.schemaVersion,
      status: "ready",
      diagnostic: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.repository.insert(layer);
    return layer;
  }

  async update(id: string, patch: LayerPatch): Promise<Layer> {
    const current = this.get(id);
    const plugin = this.requirePlugin(patch.pluginId ?? current.pluginId);
    const normalized = await this.validateInput(
      { ...inputFromLayer(current), ...patch },
      plugin,
    );
    const updated: Layer = {
      ...current,
      ...normalized,
      pluginVersion: plugin.manifest.version,
      schemaVersion: plugin.manifest.schemaVersion,
      status: "ready",
      diagnostic: null,
      updatedAt: new Date().toISOString(),
    };
    this.repository.update(updated);
    return updated;
  }

  delete(id: string): void {
    if (!this.repository.delete(id)) {
      throw new LayerNotFoundError();
    }
  }

  private requirePlugin(id: string): LayerPluginDefinition {
    const plugin = this.plugins.get(id);
    if (plugin === undefined) {
      throw new LayerValidationError(
        `The layer plugin ${id} is not registered.`,
      );
    }
    return plugin;
  }

  private async validateInput(
    input: LayerInput,
    plugin: LayerPluginDefinition,
  ): Promise<LayerInput> {
    if (
      input.minimumZoom !== null &&
      input.maximumZoom !== null &&
      input.minimumZoom > input.maximumZoom
    ) {
      throw new LayerValidationError(
        "The minimum layer zoom cannot exceed the maximum.",
      );
    }
    try {
      const configuration = requireRecord(
        await plugin.shared.validateConfiguration(input.configuration),
        "Layer configuration",
      );
      const data = requireRecord(
        await plugin.shared.validateData(input.data),
        "Layer data",
      );
      return {
        ...input,
        name: normalizeLayerName(input.name),
        configuration,
        data,
      };
    } catch (error) {
      if (error instanceof LayerValidationError) {
        throw error;
      }
      throw new LayerValidationError(
        error instanceof Error ? error.message : "Layer validation failed.",
      );
    }
  }

  private withEffectiveStatus(layer: Layer): Layer {
    const plugin = this.plugins.get(layer.pluginId);
    if (plugin === undefined) {
      return {
        ...layer,
        status: "plugin-missing",
        diagnostic: `Plugin ${layer.pluginId} is not registered.`,
      };
    }
    if (layer.schemaVersion > plugin.manifest.schemaVersion) {
      return {
        ...layer,
        status: "incompatible",
        diagnostic:
          "The stored layer schema is newer than the registered plugin.",
      };
    }
    return layer;
  }

  private async reconcile(layer: Layer): Promise<void> {
    const plugin = this.plugins.get(layer.pluginId);
    if (plugin === undefined) {
      return;
    }
    if (layer.schemaVersion > plugin.manifest.schemaVersion) {
      if (layer.status !== "incompatible") {
        this.repository.update({
          ...layer,
          status: "incompatible",
          diagnostic:
            "The stored layer schema is newer than the registered plugin.",
          updatedAt: new Date().toISOString(),
        });
      }
      return;
    }
    let configuration: unknown = layer.configuration;
    let data: unknown = layer.data;
    let opacity = layer.opacity;
    let schemaVersion = layer.schemaVersion;
    try {
      while (schemaVersion < plugin.manifest.schemaVersion) {
        const migration = plugin.shared.migrations.find(
          (candidate) => candidate.fromSchemaVersion === schemaVersion,
        );
        if (migration === undefined) {
          throw new Error(`Missing migration from schema ${schemaVersion}.`);
        }
        const migrationState = { configuration, data, opacity };
        const first =
          migration.migrateLayer === undefined
            ? {
                ...migrationState,
                data: await migration.migrate?.(data),
              }
            : await migration.migrateLayer(migrationState);
        const second =
          migration.migrateLayer === undefined
            ? {
                ...migrationState,
                data: await migration.migrate?.(data),
              }
            : await migration.migrateLayer(migrationState);
        if (JSON.stringify(first) !== JSON.stringify(second)) {
          throw new Error(
            `Migration from schema ${schemaVersion} is not deterministic.`,
          );
        }
        if (
          !Number.isFinite(first.opacity) ||
          first.opacity < 0 ||
          first.opacity > 1
        ) {
          throw new Error("Migration produced invalid Layer opacity.");
        }
        configuration = first.configuration;
        data = first.data;
        opacity = first.opacity;
        schemaVersion = migration.toSchemaVersion;
      }
      const validated = requireRecord(
        await plugin.shared.validateData(data),
        "Layer data",
      );
      const validatedConfiguration = requireRecord(
        await plugin.shared.validateConfiguration(configuration),
        "Layer configuration",
      );
      if (
        schemaVersion !== layer.schemaVersion ||
        layer.pluginVersion !== plugin.manifest.version ||
        layer.status !== "ready"
      ) {
        const updated: Layer = {
          ...layer,
          configuration: validatedConfiguration,
          data: validated,
          opacity,
          pluginVersion: plugin.manifest.version,
          schemaVersion,
          status: "ready",
          diagnostic: null,
          updatedAt: new Date().toISOString(),
        };
        if (schemaVersion !== layer.schemaVersion) {
          this.repository.updateWithMigrationBackup(layer, updated);
        } else {
          this.repository.update(updated);
        }
      }
    } catch (error) {
      this.repository.update({
        ...layer,
        status: "migration-failed",
        diagnostic:
          error instanceof Error ? error.message : "Layer migration failed.",
        updatedAt: new Date().toISOString(),
      });
    }
  }
}
