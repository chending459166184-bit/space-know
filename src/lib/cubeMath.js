const DIRS = [
  { key: 'right', dx: 1, dy: 0, axis: 'y', sign: 1 },
  { key: 'left', dx: -1, dy: 0, axis: 'y', sign: -1 },
  { key: 'up', dx: 0, dy: 1, axis: 'x', sign: -1 },
  { key: 'down', dx: 0, dy: -1, axis: 'x', sign: 1 },
];

const FACE_BY_NORMAL = {
  '0,0,1': '前面',
  '0,0,-1': '后面',
  '0,1,0': '上面',
  '0,-1,0': '下面',
  '-1,0,0': '左面',
  '1,0,0': '右面',
};

const FACE_ORDER = ['前面', '后面', '上面', '下面', '左面', '右面'];

export const FACE_STYLES = {
  前面: { color: '#ff6b6b', accent: '#ffd166', pattern: 'star' },
  后面: { color: '#ff8787', accent: '#fff1a8', pattern: 'star' },
  上面: { color: '#62b6ff', accent: '#e7f5ff', pattern: 'cloud' },
  下面: { color: '#8ecbff', accent: '#f0fbff', pattern: 'cloud' },
  左面: { color: '#6edb86', accent: '#2f9e44', pattern: 'tree' },
  右面: { color: '#93e6a5', accent: '#1b7f37', pattern: 'tree' },
};

export function keyOf([x, y]) {
  return `${x},${y}`;
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v, n) {
  return [v[0] * n, v[1] * n, v[2] * n];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function rotateQuarter(v, axis, sign) {
  // 把一个面绕公共边旋转 90 度，得到折成立方体后的方向。
  const parallel = scale(axis, dot(axis, v));
  const turned = scale(cross(axis, v), sign);
  return add(parallel, turned).map((n) => Math.round(n));
}

function rotateBasis(parentBasis, dir) {
  const axis = dir.axis === 'x' ? parentBasis.x : parentBasis.y;
  return {
    x: rotateQuarter(parentBasis.x, axis, dir.sign),
    y: rotateQuarter(parentBasis.y, axis, dir.sign),
    z: rotateQuarter(parentBasis.z, axis, dir.sign),
  };
}

function normalLabel(normal) {
  return FACE_BY_NORMAL[normal.join(',')] ?? '面';
}

export function prepareNet(net) {
  const cellMap = new Map(net.cells.map((cell) => [keyOf(cell), cell]));
  const rootKey = keyOf(net.root);
  const nodes = new Map();
  const queue = [rootKey];

  nodes.set(rootKey, {
    id: rootKey,
    cell: net.root,
    parentId: null,
    dirFromParent: null,
    children: [],
    basis: { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] },
  });

  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i];
    const node = nodes.get(id);

    for (const dir of DIRS) {
      const nextCell = [node.cell[0] + dir.dx, node.cell[1] + dir.dy];
      const nextKey = keyOf(nextCell);
      if (!cellMap.has(nextKey) || nodes.has(nextKey)) continue;

      const child = {
        id: nextKey,
        cell: cellMap.get(nextKey),
        parentId: id,
        dirFromParent: dir,
        children: [],
        basis: rotateBasis(node.basis, dir),
      };
      nodes.set(nextKey, child);
      node.children.push(nextKey);
      queue.push(nextKey);
    }
  }

  const faces = [...nodes.values()].map((node) => ({
    ...node,
    label: normalLabel(node.basis.z),
    normal: node.basis.z,
  }));

  const nodeById = new Map(faces.map((face) => [face.id, face]));
  const labelToId = Object.fromEntries(faces.map((face) => [face.label, face.id]));
  const oppositeById = {};

  for (const face of faces) {
    const opposite = faces.find((candidate) => dot(face.normal, candidate.normal) === -1);
    if (opposite) oppositeById[face.id] = opposite.id;
  }

  const pairs = [];
  const used = new Set();
  for (const face of faces) {
    const oppositeId = oppositeById[face.id];
    if (!oppositeId || used.has(face.id) || used.has(oppositeId)) continue;
    used.add(face.id);
    used.add(oppositeId);
    const pair = [face, nodeById.get(oppositeId)].sort(
      (a, b) => FACE_ORDER.indexOf(a.label) - FACE_ORDER.indexOf(b.label),
    );
    pairs.push(pair);
  }

  const xs = net.cells.map(([x]) => x - net.root[0]);
  const ys = net.cells.map(([, y]) => y - net.root[1]);
  const center = [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];

  return {
    ...net,
    rootKey,
    nodes,
    faces,
    nodeById,
    labelToId,
    oppositeById,
    pairs,
    flatCenter: center,
  };
}

export function relationText(a, b) {
  const labels = [a, b].sort((x, y) => FACE_ORDER.indexOf(x) - FACE_ORDER.indexOf(y));
  const key = labels.join('-');
  if (key === '前面-后面') return '前面和后面是对面，它们隔着小盒子看着对方。';
  if (key === '上面-下面') return '上面和下面是对面，就像天花板和地板。';
  if (key === '左面-右面') return '左面和右面是对面，就像左墙和右墙。';
  return `${a}和${b}是对面。`;
}
