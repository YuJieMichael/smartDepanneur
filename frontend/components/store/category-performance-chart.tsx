"use client";

import { Empty } from "antd";
import type { DailyCloseoutReport } from "@/api/dashboard";

type Locale = "en" | "fr" | "zh";

interface CategoryPerformanceChartProps {
  categories: DailyCloseoutReport["categories"];
  locale: Locale;
  valueFormatter: (value: string | number) => string;
  labelFormatter: (label: string) => string;
}

export default function CategoryPerformanceChart({
  categories,
  locale,
  valueFormatter,
  labelFormatter,
}: CategoryPerformanceChartProps) {
  const labels = {
    revenue: locale === "zh" ? "销售额" : locale === "fr" ? "Ventes" : "Sales",
    profit:
      locale === "zh" ? "毛利" : locale === "fr" ? "Profit brut" : "Gross Profit",
    empty:
      locale === "zh"
        ? "今日暂无分类销售"
        : locale === "fr"
          ? "Aucune vente par catégorie aujourd’hui"
          : "No category sales today",
  };
  const rows = [...categories].sort(
    (left, right) => Number(right.revenue) - Number(left.revenue),
  );
  const maxValue = Math.max(...rows.map((row) => Number(row.revenue)), 0);

  if (maxValue <= 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.empty} />;
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 16,
          marginBottom: 14,
          color: "#595959",
          fontSize: 12,
        }}
      >
        <Legend color="#1677ff" label={labels.revenue} />
        <Legend color="#52c41a" label={labels.profit} />
      </div>
      <div
        role="img"
        aria-label={rows
          .map(
            (row) =>
              `${labelFormatter(row.categoryName)}: ${labels.revenue} ${valueFormatter(row.revenue)}, ${labels.profit} ${valueFormatter(row.grossProfit)}`,
          )
          .join("; ")}
        style={{ display: "grid", gap: 17 }}
      >
        {rows.map((row) => (
          <div key={row.categoryId ?? "uncategorized"}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 7,
                fontSize: 13,
              }}
            >
              <strong>{labelFormatter(row.categoryName)}</strong>
              <span style={{ color: "#595959" }}>
                {valueFormatter(row.revenue)}
              </span>
            </div>
            <MetricTrack
              value={Number(row.revenue)}
              maxValue={maxValue}
              color="linear-gradient(90deg, #69b1ff, #1677ff)"
              title={`${labels.revenue}: ${valueFormatter(row.revenue)}`}
            />
            <MetricTrack
              value={Number(row.grossProfit)}
              maxValue={maxValue}
              color="linear-gradient(90deg, #95de64, #52c41a)"
              title={`${labels.profit}: ${valueFormatter(row.grossProfit)}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        aria-hidden
        style={{
          width: 9,
          height: 9,
          borderRadius: 3,
          background: color,
        }}
      />
      {label}
    </span>
  );
}

function MetricTrack({
  value,
  maxValue,
  color,
  title,
}: {
  value: number;
  maxValue: number;
  color: string;
  title: string;
}) {
  const width = maxValue > 0 ? Math.max(2, (value / maxValue) * 100) : 0;

  return (
    <div
      title={title}
      style={{
        height: 8,
        borderRadius: 999,
        background: "#f0f0f0",
        overflow: "hidden",
        marginTop: 5,
      }}
    >
      <div
        style={{
          width: `${width}%`,
          height: "100%",
          borderRadius: 999,
          background: color,
        }}
      />
    </div>
  );
}
