interface Props {
  view: 'builder' | 'saved';
  onNavigate: (view: 'builder' | 'saved') => void;
}

export default function Sidebar({ view, onNavigate }: Props) {
  return (
    <aside className="sidebar">
      <a href="#" className="brand">
        <span className="brand-mark">t</span>
        Tripwise
      </a>
      <nav>
        <button
          type="button"
          className={`nav-item${view === 'builder' ? ' active' : ''}`}
          onClick={() => onNavigate('builder')}
        >
          <span className="nav-icon">✦</span>Trip Builder
        </button>
        <button
          type="button"
          className={`nav-item${view === 'saved' ? ' active' : ''}`}
          onClick={() => onNavigate('saved')}
        >
          <span className="nav-icon">✈</span>Saved Trips
        </button>
        <button type="button" className="nav-item">
          <span className="nav-icon">⚙</span>Settings
        </button>
      </nav>
      <div className="sidebar-footer">
        <button type="button" className="help-link">
          Help &amp; feedback
        </button>
        <div className="profile">
          <div className="avatar">EA</div>
          <div>
            You
            <small>Free plan</small>
          </div>
          <span>›</span>
        </div>
      </div>
    </aside>
  );
}
