import React, { useMemo, useState } from 'react';
import CubePage from './pages/CubePage.jsx';

const SHAPES = [
  {
    id: 'cube',
    title: '正方体',
    subtitle: '6个面都一样大',
    detail: '已完成：展开、折叠、对面关系、互动练习',
    status: 'ready',
  },
  {
    id: 'cuboid',
    title: '长方体',
    subtitle: '6个面，三组对面相等',
    detail: '待建设：支持不同边长和面关系观察',
    status: 'coming',
  },
  {
    id: 'cylinder',
    title: '圆柱体',
    subtitle: '两个圆面 + 一个侧面',
    detail: '待建设：圆柱侧面展开关系',
    status: 'coming',
  },
  {
    id: 'cone',
    title: '圆锥体',
    subtitle: '一个圆面 + 一个扇形侧面',
    detail: '待建设：扇形展开与顶点关系',
    status: 'coming',
  },
];

function PlaceholderDetail({ shape, onBack }) {
  return (
    <main className="placeholder-page">
      <header className="placeholder-topbar">
        <button className="back-btn" onClick={onBack}>
          返回首页
        </button>
        <h1>{shape.title}</h1>
      </header>
      <section className="placeholder-card">
        <p>{shape.subtitle}</p>
        <p>{shape.detail}</p>
        <p>这个详情页结构已经接好，后续可直接在这里加入该立体的互动教学内容。</p>
      </section>
    </main>
  );
}

function HomePage({ onOpen }) {
  return (
    <main className="home-page">
      <header className="home-header">
        <h1>立体认知小工坊</h1>
        <p>选择一个立体，进入对应的互动学习页面。</p>
      </header>

      <section className="shape-grid" aria-label="立体列表">
        {SHAPES.map((shape) => (
          <button key={shape.id} className="shape-card" onClick={() => onOpen(shape.id)}>
            <span className={shape.status === 'ready' ? 'shape-tag ready' : 'shape-tag coming'}>
              {shape.status === 'ready' ? '可体验' : '建设中'}
            </span>
            <h2>{shape.title}</h2>
            <p>{shape.subtitle}</p>
            <small>{shape.detail}</small>
          </button>
        ))}
      </section>
    </main>
  );
}

function HomeApp() {
  const [activeShapeId, setActiveShapeId] = useState(null);
  const activeShape = useMemo(() => SHAPES.find((shape) => shape.id === activeShapeId) ?? null, [activeShapeId]);

  if (!activeShape) return <HomePage onOpen={setActiveShapeId} />;
  if (activeShape.id === 'cube') {
    return (
      <>
        <button className="floating-home-btn" onClick={() => setActiveShapeId(null)}>
          返回首页
        </button>
        <CubePage />
      </>
    );
  }
  return <PlaceholderDetail shape={activeShape} onBack={() => setActiveShapeId(null)} />;
}

export default HomeApp;
