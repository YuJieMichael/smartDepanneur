'use client';

export const STORE_CHART_COLORS = [
  '#1677ff',
  '#13c2c2',
  '#52c41a',
  '#faad14',
  '#722ed1',
  '#eb2f96',
  '#fa541c',
  '#2f54eb',
];

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  centerValue: string;
  centerLabel: string;
  emptyText: string;
  valueFormatter?: (value: number) => string;
}

export default function DonutChart({
  slices,
  centerValue,
  centerLabel,
  emptyText,
  valueFormatter = (value) => String(value),
}: DonutChartProps) {
  const visibleSlices = slices.filter(
    (slice) => Number.isFinite(slice.value) && slice.value > 0,
  );
  const total = visibleSlices.reduce((sum, slice) => sum + slice.value, 0);
  let progress = 0;
  const gradient =
    total > 0
      ? `conic-gradient(${visibleSlices
          .map((slice, index) => {
            const start = progress;
            progress += (slice.value / total) * 100;
            return `${slice.color ?? STORE_CHART_COLORS[index % STORE_CHART_COLORS.length]} ${start}% ${progress}%`;
          })
          .join(', ')})`
      : '#edf2f7';

  return (
    <div>
      <div
        role="img"
        aria-label={
          total > 0
            ? visibleSlices
                .map(
                  (slice) =>
                    `${slice.label}: ${((slice.value / total) * 100).toFixed(1)}%`,
                )
                .join(', ')
            : emptyText
        }
        style={{
          width: 176,
          height: 176,
          margin: '0 auto 20px',
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          background: gradient,
          boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 30,
            display: 'grid',
            placeItems: 'center',
            alignContent: 'center',
            padding: 8,
            borderRadius: '50%',
            textAlign: 'center',
            background: '#fff',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.08)',
          }}
        >
          <strong style={{ fontSize: 19, lineHeight: 1.2 }}>
            {total > 0 ? centerValue : '—'}
          </strong>
          <span style={{ marginTop: 4, color: '#8c8c8c', fontSize: 12 }}>
            {total > 0 ? centerLabel : emptyText}
          </span>
        </div>
      </div>

      {total > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '10px 14px',
          }}
        >
          {visibleSlices.map((slice, index) => (
            <div
              key={slice.key}
              style={{
                minWidth: 0,
                display: 'grid',
                gridTemplateColumns: '10px minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: 7,
                fontSize: 12,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background:
                    slice.color ??
                    STORE_CHART_COLORS[index % STORE_CHART_COLORS.length],
                }}
              />
              <span
                title={slice.label}
                style={{
                  overflow: 'hidden',
                  color: '#5f6b7a',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {slice.label}
              </span>
              <strong>{valueFormatter(slice.value)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
