// Inspect a synthetic-corpus diagnostic snapshot; never capture user books.
const fs = require('node:fs');
const snapshot = JSON.parse(fs.readFileSync(process.argv[2] || 'release-artifacts/stress-after-close.heapsnapshot', 'utf8'));
const meta = snapshot.snapshot.meta;
const stride = meta.node_fields.length, edgeStride = meta.edge_fields.length;
const nameAt = meta.node_fields.indexOf('name'), countAt = meta.node_fields.indexOf('edge_count');
const sizeAt = meta.node_fields.indexOf('self_size'), typeAt = meta.node_fields.indexOf('type');
const types = meta.node_types[typeAt], edgeTypes = meta.edge_types[0];
const strings = snapshot.strings, nodes = snapshot.nodes, edges = snapshot.edges;
const incoming = new Map(), totals = new Map();
let cursor = 0;
for (let index = 0; index < nodes.length; index += stride) {
  const name = strings[nodes[index + nameAt]], type = types[nodes[index + typeAt]];
  if (/Document|Contents|IframeView|ViewManager|Detached|ResizeObserver/.test(name)) {
    const key = `${type}: ${name}`, value = totals.get(key) || { count: 0, selfBytes: 0, example: index };
    value.count++; value.selfBytes += nodes[index + sizeAt]; totals.set(key, value);
  }
  for (let edge = 0; edge < nodes[index + countAt]; edge++, cursor += edgeStride) {
    if (edgeTypes[edges[cursor]] === 'weak') continue;
    const destination = edges[cursor + 2];
    const list = incoming.get(destination) || [];
    list.push({ from: index, label: edgeTypes[edges[cursor]] === 'element' ? String(edges[cursor + 1]) : strings[edges[cursor + 1]] });
    incoming.set(destination, list);
  }
}
const describe = index => `${types[nodes[index + typeAt]]}: ${strings[nodes[index + nameAt]]}`;
function pathToRoot(target) {
  const queue = [{ index: target, path: [describe(target)] }], seen = new Set([target]);
  for (let pos = 0; pos < queue.length && pos < 100000; pos++) {
    const item = queue[pos];
    if (item.index === 0) return item.path.reverse();
    if (item.path.length > 25) continue;
    for (const edge of incoming.get(item.index) || []) if (!seen.has(edge.from)) {
      seen.add(edge.from); queue.push({ index: edge.from, path: [...item.path, `${describe(edge.from)} [${edge.label}]`] });
    }
  }
  return ['No short strong path found'];
}
const report = [...totals].filter(([key]) => !key.startsWith('string:') && !key.startsWith('code:')).map(([name, value]) => ({ name, ...value, strongPath: pathToRoot(value.example) }));
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2));
else console.log(JSON.stringify(report, null, 2));
