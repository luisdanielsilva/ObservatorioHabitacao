-- Bounding boxes of area boundaries, for fast point and map-view lookups.
-- Kept in sync with area_boundaries by the triggers below.
CREATE VIRTUAL TABLE `area_boundaries_rtree` USING rtree(`area_id`, `min_lng`, `max_lng`, `min_lat`, `max_lat`);
--> statement-breakpoint
CREATE TRIGGER `area_boundaries_rtree_insert` AFTER INSERT ON `area_boundaries` BEGIN
  INSERT INTO `area_boundaries_rtree` VALUES (NEW.`area_id`, NEW.`min_lng`, NEW.`max_lng`, NEW.`min_lat`, NEW.`max_lat`);
END;
--> statement-breakpoint
CREATE TRIGGER `area_boundaries_rtree_update` AFTER UPDATE ON `area_boundaries` BEGIN
  DELETE FROM `area_boundaries_rtree` WHERE `area_id` = OLD.`area_id`;
  INSERT INTO `area_boundaries_rtree` VALUES (NEW.`area_id`, NEW.`min_lng`, NEW.`max_lng`, NEW.`min_lat`, NEW.`max_lat`);
END;
--> statement-breakpoint
CREATE TRIGGER `area_boundaries_rtree_delete` AFTER DELETE ON `area_boundaries` BEGIN
  DELETE FROM `area_boundaries_rtree` WHERE `area_id` = OLD.`area_id`;
END;
