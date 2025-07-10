import LogicFlow from '@logicflow/core';

type AvoidancePluginOptions = {
  avoidPadding?: number;
  enabled?: boolean;
};

export class AvoidancePlugin {
  static pluginName = 'avoidance';
  private lf: LogicFlow;
  private options: AvoidancePluginOptions;
  private defaultOptions: AvoidancePluginOptions = {
    avoidPadding: 10,
    enabled: true,
  };

  constructor({ lf, options }: { lf: LogicFlow; options?: AvoidancePluginOptions }) {
    this.lf = lf;
    // Ensure default options are applied if user options don't specify all keys
    this.options = { ...this.defaultOptions, ...options };

    // Initial attachment of event listeners is based on the initial 'enabled' state.
    if (this.options.enabled) {
      this.initialize();
    }
  }

  private initialize() {
    this.lf.on('graph:rendered', this.handleGraphRendered);
    this.lf.on('edge:add', this.handleEdgeAdd);
    this.lf.on('node:move:end', this.handleNodeMoveEnd);
    // Consider node:drag for real-time updates if performance allows
    this.lf.on('edge:change:source:end', this.handleEdgeEndpointChange);
    this.lf.on('edge:change:target:end', this.handleEdgeEndpointChange);
    console.log('AvoidancePlugin initialized and event listeners attached');
  }

  private detachEvents() {
    this.lf.off('graph:rendered', this.handleGraphRendered);
    this.lf.off('edge:add', this.handleEdgeAdd);
    this.lf.off('node:move:end', this.handleNodeMoveEnd);
    this.lf.off('edge:change:source:end', this.handleEdgeEndpointChange);
    this.lf.off('edge:change:target:end', this.handleEdgeEndpointChange);
    console.log('AvoidancePlugin event listeners detached');
  }

  public enable() {
    if (!this.options.enabled) {
      this.options.enabled = true;
      this.initialize();
      console.log('AvoidancePlugin enabled');
    }
  }

  public disable() {
    if (this.options.enabled) {
      this.options.enabled = false;
      this.detachEvents();
      console.log('AvoidancePlugin disabled');
    }
  }

  private handleGraphRendered = () => {
    if (!this.options.enabled) return;
    console.log('AvoidancePlugin: graph:rendered detected');
    const edges = this.lf.getGraphRawData().edges;
    if (edges) {
      edges.forEach(edgeData => {
        const edgeModel = this.lf.getEdgeModelById(edgeData.id);
        if (edgeModel) {
          this.updateEdgePath(edgeModel);
        }
      });
    }
  };

  private handleEdgeAdd = ({ data }: { data: LogicFlow.EdgeData }) => {
    if (!this.options.enabled) return;
    console.log('AvoidancePlugin: edge:add detected', data);
    const edgeModel = this.lf.getEdgeModelById(data.id);
    if (edgeModel) {
      this.updateEdgePath(edgeModel);
    }
  };

  private handleNodeMoveEnd = ({ data }: { data: LogicFlow.NodeData }) => {
    if (!this.options.enabled) return;
    console.log('AvoidancePlugin: node:move:end detected', data);
    const nodeModel = this.lf.getNodeModelById(data.id);
    if (nodeModel) {
      const relatedEdges = this.lf.getNodeEdges(data.id);
      relatedEdges.forEach(edgeModel => {
        this.updateEdgePath(edgeModel);
      });
    }
  };

  private handleEdgeEndpointChange = ({ data }: { data: LogicFlow.EdgeData }) => {
    if (!this.options.enabled) return;
    console.log('AvoidancePlugin: edge endpoint change detected', data);
    const edgeModel = this.lf.getEdgeModelById(data.id);
    if (edgeModel) {
      this.updateEdgePath(edgeModel);
    }
  };

  private updateEdgePath(edgeModel: LogicFlow.BaseEdgeModel) {
    if (!this.options.enabled || !this.lf) return;

    const { startPoint, endPoint, sourceNode, targetNode } = edgeModel;
    if (!startPoint || !endPoint || !sourceNode || !targetNode) {
      console.warn(`AvoidancePlugin: Edge ${edgeModel.id} missing start/end point or source/target node.`);
      return;
    }

    const allNodes = this.lf.getGraphElements().nodes;
    const obstacles: Rect[] = [];
    allNodes.forEach(node => {
      if (node.id !== sourceNode.id && node.id !== targetNode.id) {
        obstacles.push(this.getExpandedNodeBox(node, this.options.avoidPadding!));
      }
    });

    let newPointsList: LogicFlow.Point[] = [startPoint, endPoint];

    let path 직선 = newPointsList; // Use a more descriptive variable name, "pathDirect"
    let collisionDetected = false;
    for (const obstacle of obstacles) {
      if (AvoidancePlugin.isLineIntersectRect(path 직선[0], path 직선[1], obstacle)) {
        collisionDetected = true;
        // Simple avoidance: try a two-turn path (Horizontal -> Vertical -> Horizontal)
        // This is a very basic strategy and will need significant improvement.
        const intermediateY = obstacle.y - this.options.avoidPadding!; // Try to go above
        // Alternative: const intermediateY = obstacle.y + obstacle.height + this.options.avoidPadding; // Try to go below

        const p1: LogicFlow.Point = { x: startPoint.x, y: intermediateY };
        const p2: LogicFlow.Point = { x: endPoint.x, y: intermediateY };

        let candidatePath: LogicFlow.Point[] = [startPoint, p1, p2, endPoint];
        let candidateCollision = false;
        for(let i = 0; i < candidatePath.length - 1; i++) {
          for (const obs of obstacles) {
            // Check if the new segments intersect any obstacle (including the one we are trying to avoid)
            if (AvoidancePlugin.isLineIntersectRect(candidatePath[i], candidatePath[i+1], obs)) {
              candidateCollision = true;
              break;
            }
          }
          if (candidateCollision) break;
        }

        if (!candidateCollision) {
          newPointsList = candidatePath;
        } else {
          // Fallback: Try Vertical -> Horizontal -> Vertical
           const intermediateX = obstacle.x - this.options.avoidPadding!; // Try to go left
          // Alternative: const intermediateX = obstacle.x + obstacle.width + this.options.avoidPadding; // Try to go right
          const pV1: LogicFlow.Point = { x: intermediateX, y: startPoint.y };
          const pV2: LogicFlow.Point = { x: intermediateX, y: endPoint.y };
          candidatePath = [startPoint, pV1, pV2, endPoint];
          candidateCollision = false;
          for(let i = 0; i < candidatePath.length - 1; i++) {
            for (const obs of obstacles) {
              if (AvoidancePlugin.isLineIntersectRect(candidatePath[i], candidatePath[i+1], obs)) {
                candidateCollision = true;
                break;
              }
            }
            if (candidateCollision) break;
          }
          if (!candidateCollision) {
            newPointsList = candidatePath;
          } else {
            // If both simple strategies fail, keep original or just log for now
            console.warn(`AvoidancePlugin: Edge ${edgeModel.id} - Basic avoidance failed for obstacle.`);
             // Keep direct path if simple avoidance fails and also collides
          }
        }
        // For now, break after first collision and attempting to reroute.
        // More sophisticated algorithms would handle multiple collisions.
        break;
      }
    }

    // Filter out consecutive duplicate points if any (can happen if intermediate points are same as start/end)
    newPointsList = newPointsList.filter((point, index, self) =>
        index === 0 || !(point.x === self[index - 1].x && point.y === self[index - 1].y)
    );


    edgeModel.pointsList = newPointsList;

    // After updating pointsList, trigger necessary updates on the model
    if (typeof (edgeModel as any).initPoints === 'function') {
      // For PolylineEdgeModel and potentially other custom edges that rely on it
      (edgeModel as any).initPoints();
    }

    if (typeof edgeModel.resetTextPosition === 'function') {
      edgeModel.resetTextPosition();
    } else if (typeof (edgeModel as any).updateTextPosition === 'function') { // Fallback for older or different API
      (edgeModel as any).updateTextPosition();
    }

    // Force graph refresh for the specific edge.
    // This is a more targeted way than re-rendering the whole graph.
    // First, tell the graph that the edge's data has changed.
    this.lf.graphModel.changeEdgeId(edgeModel.id, edgeModel.id); // This is a bit of a hack to trigger re-render for the specific edge
                                                               // A more direct "refreshEdgeView(edgeId)" would be ideal if available.
    // alternatively, emitting an event that the view listens to might be cleaner.
    // For example, if there was an event like 'edge:path:updated'.
    // Or, as a last resort:
    // edgeModel.updateAttributes({ pointsList: newPointsList }); // Avoid if possible due to performance implications.

    console.log(`AvoidancePlugin: Edge ${edgeModel.id} new path applied and view update triggered.`);
    console.log(`AvoidancePlugin: Edge ${edgeModel.id} final pointsList:`, edgeModel.pointsList.map(p => `(${p.x},${p.y})`).join(' -> '));
  }

  // Helper type for representing a rectangle
  type Rect = { x: number; y: number; width: number; height: number };

  /**
   * Calculates the expanded bounding box of a node.
   * @param nodeModel The node model.
   * @param padding The padding to add around the node.
   * @returns The expanded bounding box.
   */
  private getExpandedNodeBox(nodeModel: LogicFlow.BaseNodeModel, padding: number): Rect {
    const { x, y, width, height } = nodeModel;
    return {
      x: x - width / 2 - padding,
      y: y - height / 2 - padding,
      width: width + padding * 2,
      height: height + padding * 2,
    };
  }

  /**
   * Checks if two rectangles overlap.
   * @param rect1 The first rectangle.
   * @param rect2 The second rectangle.
   * @returns True if the rectangles overlap, false otherwise.
   */
  private static isRectOverlap(rect1: Rect, rect2: Rect): boolean {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }

  /**
   * Checks if a line segment intersects with a rectangle.
   * Based on Liang-Barsky line clipping algorithm (simplified for intersection check).
   * @param p1 Start point of the line segment.
   * @param p2 End point of the line segment.
   * @param rect The rectangle.
   * @returns True if the line segment intersects the rectangle, false otherwise.
   */
  private static isLineIntersectRect(p1: LogicFlow.Point, p2: LogicFlow.Point, rect: Rect): boolean {
    const { x: rectX, y: rectY, width: rectWidth, height: rectHeight } = rect;
    const rectMinX = rectX;
    const rectMaxX = rectX + rectWidth;
    const rectMinY = rectY;
    const rectMaxY = rectY + rectHeight;

    // Check if either endpoint is inside the rectangle
    if (
      (p1.x >= rectMinX && p1.x <= rectMaxX && p1.y >= rectMinY && p1.y <= rectMaxY) ||
      (p2.x >= rectMinX && p2.x <= rectMaxX && p2.y >= rectMinY && p2.y <= rectMaxY)
    ) {
      return true;
    }

    // Check for intersection with each of the 4 rectangle sides
    // Top edge: (rectMinX, rectMinY) to (rectMaxX, rectMinY)
    if (this.isLineSegmentsIntersect(p1, p2, { x: rectMinX, y: rectMinY }, { x: rectMaxX, y: rectMinY })) return true;
    // Bottom edge: (rectMinX, rectMaxY) to (rectMaxX, rectMaxY)
    if (this.isLineSegmentsIntersect(p1, p2, { x: rectMinX, y: rectMaxY }, { x: rectMaxX, y: rectMaxY })) return true;
    // Left edge: (rectMinX, rectMinY) to (rectMinX, rectMaxY)
    if (this.isLineSegmentsIntersect(p1, p2, { x: rectMinX, y: rectMinY }, { x: rectMinX, y: rectMaxY })) return true;
    // Right edge: (rectMaxX, rectMinY) to (rectMaxX, rectMaxY)
    if (this.isLineSegmentsIntersect(p1, p2, { x: rectMaxX, y: rectMinY }, { x: rectMaxX, y: rectMaxY })) return true;

    return false;
  }

   /**
   * Checks if two line segments intersect.
   * (Helper for isLineIntersectRect)
   * Source: https://stackoverflow.com/a/24392281/1352013 (orientation method)
   */
  private static orientation(p: LogicFlow.Point, q: LogicFlow.Point, r: LogicFlow.Point): number {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (val === 0) return 0; // Collinear
    return val > 0 ? 1 : 2; // Clockwise or Counterclockwise
  }

  private static onSegment(p: LogicFlow.Point, q: LogicFlow.Point, r: LogicFlow.Point): boolean {
    return (
      q.x <= Math.max(p.x, r.x) &&
      q.x >= Math.min(p.x, r.x) &&
      q.y <= Math.max(p.y, r.y) &&
      q.y >= Math.min(p.y, r.y)
    );
  }

  private static isLineSegmentsIntersect(
    p1: LogicFlow.Point, q1: LogicFlow.Point,
    p2: LogicFlow.Point, q2: LogicFlow.Point
  ): boolean {
    const o1 = this.orientation(p1, q1, p2);
    const o2 = this.orientation(p1, q1, q2);
    const o3 = this.orientation(p2, q2, p1);
    const o4 = this.orientation(p2, q2, q1);

    if (o1 !== o2 && o3 !== o4) {
      return true;
    }

    // Special Cases for collinear points
    if (o1 === 0 && this.onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && this.onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && this.onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && this.onSegment(p2, q1, q2)) return true;

    return false;
  }


  public setOptions(newOptions: Partial<AvoidancePluginOptions>) {
    const oldEnabledState = this.options.enabled;
    this.options = { ...this.options, ...newOptions };

    if (this.options.enabled && !oldEnabledState) {
      // Was disabled, now enabled
      this.initialize();
      // Optionally, trigger a recalculation for all edges
      this.recalculateAllEdges();
      console.log('AvoidancePlugin options updated and enabled.');
    } else if (!this.options.enabled && oldEnabledState) {
      // Was enabled, now disabled
      this.detachEvents();
      console.log('AvoidancePlugin options updated and disabled.');
    } else if (this.options.enabled && oldEnabledState) {
      // Was enabled and still enabled, but other options might have changed
      // Optionally, trigger a recalculation for all edges if relevant options changed (e.g. avoidPadding)
      if (newOptions.avoidPadding && newOptions.avoidPadding !== this.options.avoidPadding) {
         // avoidPadding has changed, recalculate all paths
        this.recalculateAllEdges();
      }
      console.log('AvoidancePlugin options updated.', this.options);
    }
  }

  private recalculateAllEdges() {
    if (!this.options.enabled || !this.lf) return;
    console.log('AvoidancePlugin: Recalculating paths for all edges due to option change.');
    const edges = this.lf.getGraphRawData().edges;
    if (edges) {
      edges.forEach(edgeData => {
        const edgeModel = this.lf.getEdgeModelById(edgeData.id);
        if (edgeModel) {
          this.updateEdgePath(edgeModel);
        }
      });
    }
  }
}

export default AvoidancePlugin;
