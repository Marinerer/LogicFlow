/**
 * LogicFlow AvoidanceEdgePlugin
 *  - A plugin to make edges avoid nodes.
 */

class AvoidanceEdgePlugin {
  static pluginName = 'avoidanceEdge';

  constructor({ lf }) {
    this.lf = lf;
    this.lf.graphModel.pluginName = 'avoidanceEdge'; // For debugging or specific plugin access
    this._init();
  }

  _init() {
    // Listen to relevant events
    this.lf.on('edge:add', this.handleEdgeChange);
    this.lf.on('node:dnd-add', this.handleNodeAdd); // When a node is dragged and added
    this.lf.on('node:move', this.handleNodeMove);
    this.lf.on('edge:change:target', this.handleEdgeChange);
    this.lf.on('edge:change:source', this.handleEdgeChange);
    this.lf.on('graph:rendered', this.handleGraphRendered);

    // Store a reference to the bound functions for later removal if needed
    this.boundFunctions = {
      handleEdgeChange: this.handleEdgeChange.bind(this),
      handleNodeAdd: this.handleNodeAdd.bind(this),
      handleNodeMove: this.handleNodeMove.bind(this),
      handleGraphRendered: this.handleGraphRendered.bind(this),
    };
  }

  // Public method to be called by users if they want to manually rerender all edges
  rerouteAllEdges() {
    const edges = this.lf.getGraphData().edges || [];
    edges.forEach(edge => this.rerouteEdge(edge));
  }

  handleGraphRendered = () => {
    // console.log('Graph rendered, rerouting all edges');
    this.rerouteAllEdges();
  }

  handleNodeAdd = ({data}) => {
    // When a new node is added, existing edges might need rerouting.
    // console.log('Node added, rerouting all edges', data);
    this.rerouteAllEdges();
  }

  handleNodeMove = ({ data }) => {
    // When a node moves, all connected edges and potentially other edges
    // that might now be obstructed by this node need rerouting.
    // console.log('Node moved, rerouting all edges', data);
    this.rerouteAllEdges(); // Simplified: reroute all for now
  }

  handleEdgeChange = ({ data }) => {
    // When an edge is added or its source/target changes.
    // console.log('Edge changed or added, rerouting edge:', data.id);
    this.rerouteEdge(data);
  }

  rerouteEdge(edge) {
    if (!edge || !edge.id) {
      // console.warn('AvoidancePlugin: Attempted to reroute an invalid edge.', edge);
      return;
    }
    const graphData = this.lf.getGraphData();
    const nodes = graphData.nodes || [];
    const currentEdgeModel = this.lf.getEdgeModelById(edge.id);

    if (!currentEdgeModel) {
        // console.warn(`AvoidancePlugin: Edge model not found for id ${edge.id}`);
        return;
    }

    const sourceNode = this.lf.getNodeModelById(edge.sourceNodeId);
    const targetNode = this.lf.getNodeModelById(edge.targetNodeId);

    if (!sourceNode || !targetNode) {
      // console.warn('AvoidancePlugin: Source or target node not found for edge:', edge.id);
      return;
    }

    const newPath = this.calculatePath(currentEdgeModel, sourceNode, targetNode, nodes);

    if (newPath && newPath.length > 0) {
      this.lf.updateEdgePoints(edge.id, newPath);
    } else {
      // Fallback to default polyline if no specific path is calculated or needed
      // This might happen if the direct line is already clear.
      // Forcing a recalculation by LogicFlow by setting points to empty array
      // or by re-setting start and end based on current node positions.
      // For now, let's try to set it to a simple direct path if no complex path needed.
      const startPoint = sourceNode.getAnchorPosition(edge.startPoint);
      const endPoint = targetNode.getAnchorPosition(edge.endPoint);
      if(startPoint && endPoint) {
        // Check if startPoint or endPoint is undefined which can happen if anchors are not set
         this.lf.updateEdgePoints(edge.id, [startPoint, endPoint]);
      } else {
        // Fallback: let LF draw its default path if anchor points are problematic
        const existingPoints = currentEdgeModel.pointsList || [];
        if (existingPoints.length === 0) {
             this.lf.updateEdgePoints(edge.id, []); // Let LF handle it
        }
        // else, keep existing points if new path calculation fails and there are already points
      }
    }
  }

  /**
   * Calculates the path for an edge, avoiding nodes.
   * This is a placeholder for the actual avoidance algorithm.
   * @param {EdgeModel} edge - The edge model.
   * @param {NodeModel} sourceNode - The source node model.
   * @param {NodeModel} targetNode - The target node model.
   * @param {Array<NodeModel>} nodes - All nodes in the graph.
   * @returns {Array<{x: number, y: number}>} - The new path points.
   */
  calculatePath(edge, sourceNode, targetNode, allNodes) {
    const startPoint = edge.startPoint || sourceNode.getAnchorPosition(); // Fallback to center if no specific startPoint
    const endPoint = edge.endPoint || targetNode.getAnchorPosition(); // Fallback to center if no specific endPoint

    if (!startPoint || !endPoint) {
        // console.error("AvoidancePlugin: Could not determine start or end point for edge", edge.id);
        return edge.pointsList; // Return existing points if any problem
    }

    // Create a list of obstacles, excluding the source and target nodes of the current edge.
    const obstacles = allNodes.filter(node => node.id !== sourceNode.id && node.id !== targetNode.id);

    // Simple direct line:
    let potentialPath = [ {x: startPoint.x, y: startPoint.y}, {x: endPoint.x, y: endPoint.y} ];

    // Check for intersections with obstacles
    let pathIsObstructed = false;
    for (const obsNode of obstacles) {
      if (this.isPathIntersectingNode(potentialPath, obsNode)) {
        pathIsObstructed = true;
        break;
      }
    }

    if (!pathIsObstructed) {
      return potentialPath; // Direct path is clear
    }

    // If obstructed, try a simple avoidance by adding one or two intermediate points.
    // This is a very basic strategy and needs significant improvement.
    // For example, try adding a point that shifts the middle of the edge
    // horizontally or vertically away from the center of the obstructing node.

    // Simplified: try to find a mid-point that is not inside any obstacle
    // This is a naive implementation and will be improved.
    const midX = (startPoint.x + endPoint.x) / 2;
    const midY = (startPoint.y + endPoint.y) / 2;

    // Try to find an obstacle-free midpoint by shifting.
    // This is highly simplified. A real algorithm would be more systematic.
    let bestPath = null;
    let minObstructions = Infinity;

    // Try a few alternative midpoints
    const offsets = [0, 20, -20, 40, -40, 60, -60]; // Pixels to shift
    for (const dx of offsets) {
        for (const dy of offsets) {
            if (dx === 0 && dy === 0 && pathIsObstructed) continue; // Already checked direct path

            const intermediatePoint1 = { x: midX + dx, y: startPoint.y + dy }; // Horizontal first
            const intermediatePoint2 = { x: midX + dx, y: endPoint.y + dy };   // Vertical first

            const path1 = [ {x: startPoint.x, y: startPoint.y}, intermediatePoint1, {x: endPoint.x, y: endPoint.y} ];
            const path2 = [ {x: startPoint.x, y: startPoint.y}, intermediatePoint2, {x: endPoint.x, y: endPoint.y} ];

            const checkAndCountObstructions = (p) => {
                let obstructions = 0;
                for (const obsNode of obstacles) {
                    if (this.isPathIntersectingNode(p, obsNode)) {
                        obstructions++;
                    }
                }
                return obstructions;
            };

            let obsCount1 = checkAndCountObstructions(path1);
            if (obsCount1 < minObstructions) {
                minObstructions = obsCount1;
                bestPath = path1;
            }
            if (obsCount1 === 0) break; // Found a clear path

            let obsCount2 = checkAndCountObstructions(path2);
             if (obsCount2 < minObstructions) {
                minObstructions = obsCount2;
                bestPath = path2;
            }
            if (obsCount2 === 0) break; // Found a clear path
        }
        if (minObstructions === 0) break;
    }

    // If still no clear path found after trying simple midpoints,
    // try adding two intermediate points for more flexibility.
    if (minObstructions > 0) {
        for (const dx1 of offsets) {
            for (const dy1 of offsets) {
                for (const dx2 of offsets) {
                    for (const dy2 of offsets) {
                        const p1 = { x: startPoint.x + dx1, y: midY + dy1 };
                        const p2 = { x: endPoint.x + dx2, y: midY + dy2 };
                        const candidatePath = [ {x:startPoint.x, y:startPoint.y}, p1, p2, {x:endPoint.x, y:endPoint.y} ];

                        let obsCount = 0;
                        for (const obsNode of obstacles) {
                            if (this.isPathIntersectingNode(candidatePath, obsNode)) {
                                obsCount++;
                            }
                        }
                        if (obsCount < minObstructions) {
                            minObstructions = obsCount;
                            bestPath = candidatePath;
                        }
                        if (minObstructions === 0) break;
                    }
                    if (minObstructions === 0) break;
                }
                if (minObstructions === 0) break;
            }
            if (minObstructions === 0) break;
        }
    }


    if (bestPath && minObstructions === 0) {
        // console.log("AvoidancePlugin: Found an alternative path for edge", edge.id, bestPath);
        return bestPath;
    } else if (bestPath) {
        // console.log("AvoidancePlugin: Found a partially better path with obstructions for edge", edge.id, bestPath);
        return bestPath; // Return the best one found, even if it's not perfect
    }

    // console.warn("AvoidancePlugin: Could not find a clear path for edge", edge.id, ". Returning original points.");
    // Fallback to the original points or a direct line if all else fails
    return edge.pointsList && edge.pointsList.length > 0 ? edge.pointsList : potentialPath;
  }

  /**
   * Checks if a path (series of line segments) intersects with a node.
   * @param {Array<{x: number, y: number}>} pathPoints - Array of points defining the path.
   * @param {NodeModel} node - The node to check against.
   * @returns {boolean} - True if intersection occurs, false otherwise.
   */
  isPathIntersectingNode(pathPoints, node) {
    if (pathPoints.length < 2) return false;

    const nodeBBox = node.getBBox(); // { minX, minY, maxX, maxY }

    for (let i = 0; i < pathPoints.length - 1; i++) {
      const p1 = pathPoints[i];
      const p2 = pathPoints[i+1];
      if (this.isLineIntersectingRect(p1, p2, nodeBBox)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if a line segment (p1, p2) intersects with a rectangle.
   * Using Liang-Barsky line clipping algorithm or simple Separating Axis Theorem check.
   * For simplicity, we'll use a basic bounding box check and line-rectangle intersection.
   */
  isLineIntersectingRect(p1, p2, rect) {
    // Check if line segment is trivial (p1 === p2)
    if (p1.x === p2.x && p1.y === p2.y) {
        return p1.x >= rect.minX && p1.x <= rect.maxX && p1.y >= rect.minY && p1.y <= rect.maxY;
    }

    // Check if either endpoint is inside the rectangle
    if (p1.x >= rect.minX && p1.x <= rect.maxX && p1.y >= rect.minY && p1.y <= rect.maxY) return true;
    if (p2.x >= rect.minX && p2.x <= rect.maxX && p2.y >= rect.minY && p2.y <= rect.maxY) return true;

    // Check intersection of the line segment with each of the four sides of the rectangle
    // Line: Ax + By = C
    // Segment 1: (rect.minX, rect.minY) to (rect.maxX, rect.minY) - Bottom edge
    // Segment 2: (rect.maxX, rect.minY) to (rect.maxX, rect.maxY) - Right edge
    // Segment 3: (rect.maxX, rect.maxY) to (rect.minX, rect.maxY) - Top edge
    // Segment 4: (rect.minX, rect.maxY) to (rect.minX, rect.minY) - Left edge
    const segments = [
        { x1: rect.minX, y1: rect.minY, x2: rect.maxX, y2: rect.minY },
        { x1: rect.maxX, y1: rect.minY, x2: rect.maxX, y2: rect.maxY },
        { x1: rect.maxX, y1: rect.maxY, x2: rect.minX, y2: rect.maxY },
        { x1: rect.minX, y1: rect.maxY, x2: rect.minX, y2: rect.minY },
    ];

    for (const seg of segments) {
        if (this.doLineSegmentsIntersect(p1, p2, {x: seg.x1, y: seg.y1}, {x: seg.x2, y: seg.y2})) {
            return true;
        }
    }
    return false;
  }

  /**
   * Checks if two line segments intersect.
   * p1, p2 define the first segment. p3, p4 define the second segment.
   */
  doLineSegmentsIntersect(p1, p2, p3, p4) {
    function orientation(p, q, r) {
        const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
        if (val === 0) return 0; // Collinear
        return (val > 0) ? 1 : 2; // Clockwise or Counterclockwise
    }

    function onSegment(p, q, r) {
        return (q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
                q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y));
    }

    const o1 = orientation(p1, p2, p3);
    const o2 = orientation(p1, p2, p4);
    const o3 = orientation(p3, p4, p1);
    const o4 = orientation(p3, p4, p2);

    // General case
    if (o1 !== o2 && o3 !== o4) {
        return true;
    }

    // Special Cases for collinear points
    if (o1 === 0 && onSegment(p1, p3, p2)) return true;
    if (o2 === 0 && onSegment(p1, p4, p2)) return true;
    if (o3 === 0 && onSegment(p3, p1, p4)) return true;
    if (o4 === 0 && onSegment(p3, p2, p4)) return true;

    return false; // Doesn't intersect
  }


  // Optional: Method to clean up when the plugin is destroyed or LogicFlow instance is destroyed
  destroy() {
    this.lf.off('edge:add', this.boundFunctions.handleEdgeChange);
    this.lf.off('node:dnd-add', this.boundFunctions.handleNodeAdd);
    this.lf.off('node:move', this.boundFunctions.handleNodeMove);
    this.lf.off('edge:change:target', this.boundFunctions.handleEdgeChange);
    this.lf.off('edge:change:source', this.boundFunctions.handleEdgeChange);
    this.lf.off('graph:rendered', this.boundFunctions.handleGraphRendered);
    // console.log('AvoidanceEdgePlugin destroyed and listeners removed.');
  }
}

// For UMD build or direct script include
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AvoidanceEdgePlugin;
} else if (typeof window !== 'undefined') {
  window.AvoidanceEdgePlugin = AvoidanceEdgePlugin;
}
