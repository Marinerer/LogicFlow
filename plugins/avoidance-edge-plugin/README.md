# LogicFlow AvoidanceEdgePlugin

## 概述

`AvoidanceEdgePlugin` 是一个为 [LogicFlow](https://github.com/didi/LogicFlow) 设计的插件，旨在智能规划连线的路径，使其能够自动避开流程图中的节点。这有助于在复杂的流程图中保持连线的清晰度和可读性。

目前插件实现了基础的节点避让逻辑。当连线与节点发生重叠时，插件会尝试通过添加一个或多个拐点来重新规划路径。

## 特性

- **自动避让节点**：在添加连线、移动节点、修改连线目标或初始渲染时，自动调整连线路径以避开节点。
- **事件驱动**：响应 LogicFlow 的核心事件，确保路径的动态更新。
- **基础路径规划**：当前版本采用在直线路径受阻时，尝试插入一至两个中间拐点进行避让的策略。

## 安装和使用

### 1. 引入插件

确保你已经安装并引入了 LogicFlow。

**方式一：通过 `<script>` 标签引入**

如果你的 `AvoidanceEdgePlugin.js` 文件位于项目的 `plugins/avoidance-edge-plugin/src/` 目录下，可以在 HTML 文件中这样引入：

```html
<!-- 引入 LogicFlow -->
<script src="https://cdn.jsdelivr.net/npm/@logicflow/core/dist/logic-flow.js"></script>
<!-- 引入插件 -->
<script src="path/to/your/plugins/avoidance-edge-plugin/src/AvoidanceEdgePlugin.js"></script>
```

**方式二：通过 npm 安装（如果已发布或本地链接）**

如果未来插件发布到 npm，或者你使用了本地 npm link：

```bash
npm install @logicflow/avoidance-edge-plugin # 假设的包名
# 或者 yarn add @logicflow/avoidance-edge-plugin
```

然后在你的项目中导入：

```javascript
import LogicFlow from '@logicflow/core';
import AvoidanceEdgePlugin from '@logicflow/avoidance-edge-plugin'; // 调整为实际路径或包名
```

### 2. 注册插件

在初始化 LogicFlow 实例时，注册 `AvoidanceEdgePlugin`：

```javascript
const lf = new LogicFlow({
    container: document.getElementById('your-container-id'),
    // ... 其他 LogicFlow 配置
    plugins: [
        AvoidanceEdgePlugin
        // ... 其他插件，例如 Menu, Snapshot 等
    ]
});
```

### 3. 使用

插件注册后会自动生效。当发生以下情况时，它将尝试重新计算并更新相关连线的路径：

- **图表渲染完成时** (`graph:rendered`)：对所有现有的边进行路径规划。
- **添加新连线时** (`edge:add`)：为新添加的边规划路径。
- **节点被拖拽添加时** (`node:dnd-add`): 所有边重新计算路径。
- **节点移动时** (`node:move`)：所有边重新计算路径（简化处理，未来可优化为仅影响相关边）。
- **连线的起点或终点改变时** (`edge:change:source`, `edge:change:target`)：为被修改的边规划路径。

## 示例

在 `plugins/avoidance-edge-plugin/example/index.html` 文件中提供了一个详细的示例页面。该示例展示了插件在不同场景下的工作情况：

- 初始节点和连线的渲染。
- 动态添加连线。
- 拖动节点。
- 在密集节点环境下的表现。

你可以直接在浏览器中打开此 HTML 文件进行体验。

```javascript
// 示例代码片段 (参考 example/index.html)

// 初始化 LogicFlow 并注册插件
const lf = new LogicFlow({
    container: document.getElementById('container'),
    grid: true,
    plugins: [
        AvoidanceEdgePlugin
    ]
});

// 渲染图数据
lf.render({
    nodes: [
        { id: 'node_a', type: 'rect', x: 100, y: 100, text: 'Node A' },
        { id: 'node_b', type: 'rect', x: 400, y: 100, text: 'Node B' },
        { id: 'node_obstacle', type: 'rect', x: 250, y: 100, text: 'Obstacle' }
    ],
    edges: [
        { sourceNodeId: 'node_a', targetNodeId: 'node_b', text: 'A to B' }
        // 预期这条边会自动避开 'node_obstacle'
    ]
});

// 手动触发所有边的重新路由 (如果需要)
// const avoidancePluginInstance = lf.extension.avoidanceEdge;
// if (avoidancePluginInstance && avoidancePluginInstance.rerouteAllEdges) {
//   avoidancePluginInstance.rerouteAllEdges();
// }
```

## 配置项

当前版本的 `AvoidanceEdgePlugin` 没有提供外部配置项。

## API

### `AvoidanceEdgePlugin.pluginName`

-   `static pluginName = 'avoidanceEdge';`
    插件的静态名称，用于 LogicFlow 内部管理和访问。

### `lf.extension.avoidanceEdge.rerouteAllEdges()` (实验性)

-   如果需要手动触发对画布上所有连线进行路径重计算，可以获取插件实例并调用此方法。
    ```javascript
    const avoidancePlugin = lf.extension.avoidanceEdge;
    if (avoidancePlugin && avoidancePlugin.rerouteAllEdges) {
        avoidancePlugin.rerouteAllEdges();
    }
    ```

## 未来可能的改进

-   **高级路径规划算法**：引入更成熟的路径查找算法（如 A* 变种、几何跳点搜索）以处理更复杂的避让场景，并生成更优化的路径。
-   **避开其他连线**：目前仅避让节点，未来可以扩展以避免连线之间的交叉和重叠。
-   **性能优化**：对于大规模图，优化算法性能，例如仅重新计算受影响区域的连线，而不是所有连线。
-   **可配置参数**：例如避让的边距、优先方向、是否启用/禁用特定类型的避让等。
-   **更平滑的拐点**：生成的路径可以考虑使用曲线或倒角，而不是尖锐的直角拐点。

## 已知问题与限制

-   **基础避让逻辑**：当前的避让算法比较简单，可能无法在所有密集或复杂布局中找到最佳路径，甚至可能失败。
-   **性能**：在节点和边数量非常多时，全局重新计算可能会有性能影响。
-   **不避让其他连线**：当前版本不会处理连线之间的重叠问题。

欢迎贡献代码或提出改进建议！
