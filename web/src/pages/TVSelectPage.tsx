import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePublicFactories } from '../api/hooks';
import { facVar } from '../lib/format';
import { Loading } from '../components/ui';

export default function TVSelectPage() {
  const nav = useNavigate();
  const factories = usePublicFactories();
  const [factoryId, setFactoryId] = useState('');

  useEffect(() => { if (factories.data && !factoryId) setFactoryId(factories.data[0].id); }, [factories.data, factoryId]);
  if (factories.isLoading) return <div className="page"><Loading /></div>;
  const f = factories.data?.find((x) => x.id === factoryId);

  return (
    <div className="page">
      <div className="page-head"><div><h1>TV Board</h1><div className="sub">Pick a line to display its live board</div></div></div>
      <div className="filters">
        {factories.data?.map((x) => (
          <button key={x.id} className="chip" aria-pressed={factoryId === x.id} onClick={() => setFactoryId(x.id)}>
            <span className="dot" style={{ background: facVar(x.code) }} />{x.code}
          </button>
        ))}
      </div>
      <div className="line-grid">
        {f?.lines.map((l) => (
          <button key={l.id} className="card line-pick" onClick={() => nav(`/tv/${l.id}`)}>
            <span className="dot" style={{ background: facVar(f.code) }} />
            <b>{l.name}</b>
            <span className="muted">{f.code}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
