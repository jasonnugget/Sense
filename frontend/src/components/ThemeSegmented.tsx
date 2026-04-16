import './ThemeSegmented.css';
export default function ThemeSegmented({ value, onChange }) {
    const options = [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'System', value: 'system' },
    ];
    const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
    const style = {
        ['--seg-index']: activeIndex,
        ['--seg-count']: options.length,
    };
    return (<div className="segmented" role="group" aria-label="Theme" style={style}>
      <div className="segmentIndicator" aria-hidden="true"/>
      {options.map((opt) => {
            const active = value === opt.value;
            return (<button key={opt.value} type="button" className={`segment ${active ? 'active' : ''}`} onClick={() => onChange(opt.value)} aria-pressed={active}>
            {opt.label}
          </button>);
        })}
    </div>);
}
