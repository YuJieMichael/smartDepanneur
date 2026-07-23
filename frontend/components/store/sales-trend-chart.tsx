"use client";

import { Empty } from "antd";
import type { SalesTrendReport } from "@/api/dashboard";

type Locale = "en" | "fr" | "zh";

interface SalesTrendChartProps {
  points: SalesTrendReport["points"];
  locale: Locale;
  valueFormatter: (value: string | number) => string;
}

export default function SalesTrendChart({
  points,
  locale,
  valueFormatter,
}: SalesTrendChartProps) {
  const labels = {
    revenue: locale === "zh" ? "收入" : locale === "fr" ? "Revenus" : "Revenue",
    profit: locale === "zh" ? "毛利" : locale === "fr" ? "Profit" : "Profit",
    empty:
      locale === "zh"
        ? "最近七天暂无销售"
        : locale === "fr"
          ? "Aucune vente au cours des sept derniers jours"
          : "No sales in the last seven days",
  };
  const values = points.flatMap((point) => [
    Number(point.revenue),
    Number(point.profit),
  ]);
  const maxValue = Math.max(...values, 0);
  const dateFormatter = new Intl.DateTimeFormat(
    locale === "zh" ? "zh-CN" : locale === "fr" ? "fr-CA" : "en-CA",
    { weekday: "short" },
  );

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
          marginBottom: 16,
          color: "#595959",
          fontSize: 12,
        }}
      >
        <Legend color="#1677ff" label={labels.revenue} />
        <Legend color="#52c41a" label={labels.profit} />
      </div>

      <div
        role="img"
        aria-label={points
          .map(
            (point) =>
              `${point.date}: ${labels.revenue} ${valueFormatter(point.revenue)}, ${labels.profit} ${valueFormatter(point.profit)}`,
          )
          .join("; ")}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
          gap: 4,
          minHeight: 230,
        }}
      >
        {points.map((point) => {
          const revenue = Number(point.revenue);
          const profit = Number(point.profit);
          return (
            <div
              key={point.date}
              style={{
                display: "grid",
                gridTemplateRows: "178px auto",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  gap: 5,
                  borderBottom: "1px solid #d9d9d9",
                }}
              >
                <Bar
                  color="linear-gradient(180deg, #69b1ff 0%, #1677ff 100%)"
                  height={toBarHeight(revenue, maxValue)}
                  title={`${labels.revenue}: ${valueFormatter(revenue)}`}
                />
                <Bar
                  color="linear-gradient(180deg, #95de64 0%, #52c41a 100%)"
                  height={toBarHeight(profit, maxValue)}
                  title={`${labels.profit}: ${valueFormatter(profit)}`}
                />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#595959" }}>
                  {dateFormatter.format(new Date(`${point.date}T12:00:00`))}
                </div>
                <div style={{ fontSize: 11, color: "#8c8c8c" }}>
                  {point.date.slice(5)}
                </div>
              </div>
            </div>
          );
        })}
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

function Bar({
  color,
  height,
  title,
}: {
  color: string;
  height: number;
  title: string;
}) {
  return (
    <div
      title={title}
      style={{
        width: 11,
        height: `${height}%`,
        minHeight: height > 0 ? 4 : 0,
        borderRadius: "5px 5px 0 0",
        background: color,
        transition: "height 180ms ease",
      }}
    />
  );
}

function toBarHeight(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) return 0;
  return Math.max(4, (value / maxValue) * 100);
}
