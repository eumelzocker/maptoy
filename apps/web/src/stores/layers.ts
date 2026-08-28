import type {
  ImageScanJobInput,
  Job,
  Layer,
  LayerAsset,
  LayerAssetPatch,
  LayerInput,
  LayerPatch,
} from "@maptoy/contracts";
import { defineStore } from "pinia";
import { apiRequest } from "../api.js";

interface LayerListResponse {
  items: Layer[];
}

interface AssetListResponse {
  items: LayerAsset[];
  nextCursor: string | null;
}

interface ImageRootListResponse {
  items: Array<{ id: string; available: boolean }>;
}

interface JobListResponse {
  items: Job[];
}

export const useLayersStore = defineStore("layers", {
  state: () => ({
    items: [] as Layer[],
    assetsByLayer: {} as Record<string, LayerAsset[]>,
    imageRoots: [] as Array<{ id: string; available: boolean }>,
    jobs: [] as Job[],
    loading: false,
    loaded: false,
    error: null as string | null,
  }),
  actions: {
    async load(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const response = await apiRequest<LayerListResponse>("api/layers");
        this.items = response.items;
        await Promise.all(this.items.map((layer) => this.loadAssets(layer.id)));
        this.loaded = true;
      } catch (error) {
        this.error =
          error instanceof Error ? error.message : "Could not load layers.";
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async loadAssets(layerId: string): Promise<void> {
      const assets: LayerAsset[] = [];
      let cursor: string | null = null;
      do {
        const query: string =
          cursor === null
            ? ""
            : `?cursor=${encodeURIComponent(cursor)}&limit=500`;
        const page: AssetListResponse = await apiRequest<AssetListResponse>(
          `api/layers/${encodeURIComponent(layerId)}/assets${query}`,
        );
        assets.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor !== null);
      this.assetsByLayer[layerId] = assets;
    },

    async loadImageRoots(): Promise<void> {
      const response =
        await apiRequest<ImageRootListResponse>("api/image-roots");
      this.imageRoots = response.items;
    },

    async create(
      pluginId: "track-layer" | "image-layer",
      name: string,
    ): Promise<Layer> {
      const input: LayerInput = {
        name,
        pluginId,
        configuration: {},
        data: pluginId === "track-layer" ? { features: [] } : {},
        visible: true,
        displayOrder: this.items.length,
        opacity: 1,
        minimumZoom: null,
        maximumZoom: null,
      };
      const layer = await apiRequest<Layer>("api/layers", {
        method: "POST",
        body: JSON.stringify(input),
      });
      this.items.push(layer);
      this.assetsByLayer[layer.id] = [];
      return layer;
    },

    async swapOrder(id: string, otherId: string): Promise<void> {
      const current = this.items.find((layer) => layer.id === id);
      const other = this.items.find((layer) => layer.id === otherId);
      if (current === undefined || other === undefined) {
        return;
      }
      await Promise.all([
        this.update(current.id, { displayOrder: other.displayOrder }),
        this.update(other.id, { displayOrder: current.displayOrder }),
      ]);
      this.items.sort(
        (left, right) =>
          left.displayOrder - right.displayOrder ||
          left.name.localeCompare(right.name),
      );
    },

    async update(id: string, patch: LayerPatch): Promise<Layer> {
      const layer = await apiRequest<Layer>(
        `api/layers/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      );
      const index = this.items.findIndex((candidate) => candidate.id === id);
      if (index !== -1) {
        this.items[index] = layer;
      }
      return layer;
    },

    async remove(id: string): Promise<void> {
      await apiRequest<void>(`api/layers/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      this.items = this.items.filter((layer) => layer.id !== id);
      delete this.assetsByLayer[id];
    },

    async uploadTrack(layerId: string, file: File): Promise<void> {
      const body = new FormData();
      body.append("file", file);
      await apiRequest(`api/layers/${encodeURIComponent(layerId)}/assets`, {
        method: "POST",
        body,
      });
      await this.load();
    },

    async updateAsset(
      layerId: string,
      assetId: string,
      patch: LayerAssetPatch,
    ): Promise<LayerAsset> {
      const asset = await apiRequest<LayerAsset>(
        `api/layers/${encodeURIComponent(layerId)}/assets/${encodeURIComponent(assetId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      );
      const assets = this.assetsByLayer[layerId] ?? [];
      const index = assets.findIndex((candidate) => candidate.id === assetId);
      if (index !== -1) {
        assets[index] = asset;
      }
      return asset;
    },

    async startImageScan(
      layerId: string,
      input: ImageScanJobInput,
    ): Promise<Job> {
      const job = await apiRequest<Job>(
        `api/layers/${encodeURIComponent(layerId)}/image-scan-jobs`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      );
      this.jobs.unshift(job);
      return job;
    },

    async loadJobs(): Promise<void> {
      const response = await apiRequest<JobListResponse>("api/jobs");
      this.jobs = response.items;
    },

    async controlJob(
      id: string,
      action: "pause" | "resume" | "cancel",
    ): Promise<Job> {
      const job = await apiRequest<Job>(
        `api/jobs/${encodeURIComponent(id)}/${action}`,
        { method: "POST" },
      );
      const index = this.jobs.findIndex((candidate) => candidate.id === id);
      if (index !== -1) {
        this.jobs[index] = job;
      }
      return job;
    },
  },
});
