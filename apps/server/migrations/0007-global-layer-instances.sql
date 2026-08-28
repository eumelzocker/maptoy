DROP INDEX layer_instances_map_set_order_index;

ALTER TABLE layer_instances DROP COLUMN map_set_id;

CREATE INDEX layer_instances_order_index
  ON layer_instances(display_order, created_at);
