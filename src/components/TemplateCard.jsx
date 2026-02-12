export function TemplateCard({ config, onBuild, onEdit, onDelete }) {
  const pageCount = config.pages?.length || 0;
  const suiteCount = config.pages?.filter(p => p.type === 'suite').length || 0;
  const overviewCount = config.pages?.filter(p => p.type === 'overview').length || 0;
  const totalDesks = config.pages
    ?.filter(p => p.type === 'suite')
    .reduce((sum, p) => sum + (p.suiteConfig?.deskCount || 0), 0) || 0;

  return (
    <div className="template-card">
      <div className="template-card-header">
        <h3>{config.name}</h3>
      </div>
      <div className="template-card-body">
        <div className="template-stats">
          <span>{pageCount} pages</span>
          {suiteCount > 0 && <span>{suiteCount} suites</span>}
          {totalDesks > 0 && <span>{totalDesks} desks</span>}
          {overviewCount > 0 && <span>{overviewCount} overviews</span>}
        </div>
      </div>
      <div className="template-card-actions">
        <button onClick={onBuild} className="btn-primary btn-card">
          Build Proposal
        </button>
        <button onClick={onEdit} className="btn-small">
          Edit Config
        </button>
        <button onClick={onDelete} className="btn-small btn-danger">
          Delete
        </button>
      </div>
    </div>
  );
}
