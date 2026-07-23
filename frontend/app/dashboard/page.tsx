"use client";

import { useCallback, useEffect, useState } from "react";
import {
  App,
  Button,
  Card,
  Col,
  Modal,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
} from "antd";
import {
  AlertOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  DollarOutlined,
  FileTextOutlined,
  LineChartOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import {
  apiGetDailyCloseout,
  apiGetDashboardOverview,
  apiGetSalesTrend,
  DailyCloseoutReport,
  DashboardOverview,
  SalesTrendReport,
} from "@/api/dashboard";
import CategoryPerformanceChart from "@/components/store/category-performance-chart";
import DonutChart from "@/components/store/donut-chart";
import SalesTrendChart from "@/components/store/sales-trend-chart";
import { useI18nStore } from "@/lib/i18n";
import { localizeStoreCategory } from "@/lib/store-category";

export default function DashboardPage() {
  const { message } = App.useApp();
  const locale = useI18nStore((state) => state.locale);
  const isZh = locale === "zh";
  const isFr = locale === "fr";
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [closeout, setCloseout] = useState<DailyCloseoutReport | null>(null);
  const [trend, setTrend] = useState<SalesTrendReport | null>(null);
  const [closeoutLoading, setCloseoutLoading] = useState(false);
  const [closeoutOpen, setCloseoutOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [overview, report, trendReport] = await Promise.all([
        apiGetDashboardOverview(),
        apiGetDailyCloseout(),
        apiGetSalesTrend(7),
      ]);
      setData(overview);
      setCloseout(report);
      setTrend(trendReport);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currencyFormatter = new Intl.NumberFormat(
    isZh ? "zh-CN" : isFr ? "fr-CA" : "en-CA",
    { style: "currency", currency: "CAD" },
  );
  const formatCurrency = (value: string | number) =>
    currencyFormatter.format(Number(value));

  const generateDailyCloseout = async () => {
    try {
      setCloseoutLoading(true);
      const report = await apiGetDailyCloseout();
      setCloseout(report);
      setCloseoutOpen(true);
    } catch {
      message.error(
        isZh
          ? "今日结算表生成失败，请稍后重试"
          : isFr
            ? "Impossible de générer la clôture du jour"
            : "Unable to generate today’s closeout report",
      );
    } finally {
      setCloseoutLoading(false);
    }
  };

  const downloadCloseoutCsv = () => {
    if (!closeout) return;

    const escapeCsv = (value: string | number) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const uncategorized = isZh
      ? "未分类"
      : isFr
        ? "Non classé"
        : "Uncategorized";
    const rows: Array<Array<string | number>> = [
      [
        isZh ? "营业日期" : isFr ? "Date commerciale" : "Business date",
        closeout.date,
      ],
      [
        isZh ? "时区" : isFr ? "Fuseau horaire" : "Time zone",
        closeout.timeZone,
      ],
      [
        isZh ? "订单数" : isFr ? "Nombre de ventes" : "Sales count",
        closeout.saleCount,
      ],
      [
        isZh
          ? "销售额（税前）"
          : isFr
            ? "Ventes avant taxes"
            : "Sales before tax",
        closeout.totals.subtotal,
      ],
      [isZh ? "税费" : isFr ? "Taxes" : "Tax", closeout.totals.tax],
      [
        isZh
          ? "今日收入（含税）"
          : isFr
            ? "Revenus avec taxes"
            : "Revenue including tax",
        closeout.totals.revenue,
      ],
      [
        isZh ? "毛利" : isFr ? "Profit brut" : "Gross profit",
        closeout.totals.grossProfit,
      ],
      [
        isZh ? "毛利率" : isFr ? "Marge brute" : "Gross margin",
        `${closeout.totals.grossMargin}%`,
      ],
      [],
      [
        isZh ? "类别" : isFr ? "Catégorie" : "Category",
        isZh ? "售出数量" : isFr ? "Quantité vendue" : "Quantity sold",
        isZh
          ? "销售额（税前）"
          : isFr
            ? "Ventes avant taxes"
            : "Sales before tax",
        isZh ? "毛利" : isFr ? "Profit brut" : "Gross profit",
        isZh ? "毛利率" : isFr ? "Marge brute" : "Gross margin",
      ],
      ...closeout.categories.map((row) => [
        row.categoryId === null
          ? uncategorized
          : localizeStoreCategory(row.categoryName, locale),
        row.quantity,
        row.revenue,
        row.grossProfit,
        `${row.grossMargin}%`,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `smartdepanneur-closeout-${closeout.date}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    message.success(
      isZh ? "结算表已下载" : isFr ? "Rapport téléchargé" : "Report downloaded",
    );
  };

  const lowStockColumns = [
    {
      title: isZh ? "商品" : isFr ? "Produit" : "Product",
      dataIndex: "name",
      key: "name",
    },
    {
      title: isZh ? "库存" : isFr ? "Stock" : "Stock",
      key: "stock",
      render: (_: unknown, row: DashboardOverview["lowStockList"][0]) => (
        <span style={{ color: "#cf1322", fontWeight: 600 }}>
          {row.currentStock} / {row.minStock}
        </span>
      ),
    },
    {
      title: isZh ? "供应商" : isFr ? "Fournisseur" : "Supplier",
      key: "supplier",
      render: (_: unknown, row: DashboardOverview["lowStockList"][0]) =>
        row.supplier ? (
          <Tag>{row.supplier.name}</Tag>
        ) : (
          <span style={{ color: "#bbb" }}>-</span>
        ),
    },
  ];

  const topSellerColumns = [
    {
      title: isZh ? "商品" : isFr ? "Produit" : "Product",
      dataIndex: "productName",
      key: "name",
    },
    {
      title: isZh
        ? "销量（总计）"
        : isFr
          ? "Vendus (total)"
          : "Sold (all time)",
      dataIndex: "totalSold",
      key: "sold",
    },
    {
      title: isZh ? "库存" : isFr ? "En stock" : "In Stock",
      dataIndex: "currentStock",
      key: "stock",
    },
  ];

  const expiringColumns = [
    {
      title: isZh ? "商品" : isFr ? "Produit" : "Product",
      dataIndex: "name",
      key: "name",
    },
    {
      title: isZh ? "库存" : isFr ? "Stock" : "Stock",
      dataIndex: "currentStock",
      key: "stock",
      width: 90,
    },
    {
      title: isZh ? "过期日期" : isFr ? "Expire le" : "Expires",
      dataIndex: "expirationDate",
      key: "expirationDate",
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      title: isZh ? "供应商" : isFr ? "Fournisseur" : "Supplier",
      key: "supplier",
      render: (_: unknown, row: DashboardOverview["expiringList"][0]) =>
        row.supplier ? (
          <Tag>{row.supplier.name}</Tag>
        ) : (
          <span style={{ color: "#bbb" }}>-</span>
        ),
    },
  ];

  const closeoutColumns = [
    {
      title: isZh ? "类别" : isFr ? "Catégorie" : "Category",
      dataIndex: "categoryName",
      key: "category",
      render: (value: string, row: DailyCloseoutReport["categories"][0]) =>
        row.categoryId === null
          ? isZh
            ? "未分类"
            : isFr
              ? "Non classé"
              : "Uncategorized"
          : localizeStoreCategory(value, locale),
    },
    {
      title: isZh ? "售出数量" : isFr ? "Quantité vendue" : "Quantity Sold",
      dataIndex: "quantity",
      key: "quantity",
      align: "right" as const,
    },
    {
      title: isZh
        ? "销售额（税前）"
        : isFr
          ? "Ventes avant taxes"
          : "Sales Before Tax",
      dataIndex: "revenue",
      key: "revenue",
      align: "right" as const,
      render: (value: string) => formatCurrency(value),
    },
    {
      title: isZh ? "毛利" : isFr ? "Profit brut" : "Gross Profit",
      dataIndex: "grossProfit",
      key: "grossProfit",
      align: "right" as const,
      render: (value: string) => formatCurrency(value),
    },
    {
      title: isZh ? "毛利率" : isFr ? "Marge brute" : "Gross Margin",
      dataIndex: "grossMargin",
      key: "grossMargin",
      align: "right" as const,
      render: (value: string) => `${Number(value).toFixed(2)}%`,
    },
  ];

  const categorySlices = (metric: "revenue" | "grossProfit" | "quantity") =>
    (closeout?.categories ?? []).map((category) => ({
      key: String(category.categoryId ?? "uncategorized"),
      label: localizeStoreCategory(category.categoryName, locale),
      value: Number(category[metric]),
    }));

  const renderDelta = (
    value: number | string | null | undefined,
    isPercent = true,
  ) => {
    if (value === undefined) return null;
    if (value === null) {
      return (
        <div style={{ marginTop: 8, color: "#1677ff", fontSize: 12 }}>
          {isZh
            ? "较昨日为新增"
            : isFr
              ? "Nouveau depuis hier"
              : "New since yesterday"}
        </div>
      );
    }

    const numericValue = Number(value);
    const color =
      numericValue > 0 ? "#389e0d" : numericValue < 0 ? "#cf1322" : "#8c8c8c";
    const prefix = numericValue > 0 ? "↑ " : numericValue < 0 ? "↓ " : "";
    const amount = isPercent
      ? `${Math.abs(numericValue).toFixed(1)}%`
      : `${numericValue > 0 ? "+" : ""}${numericValue}`;
    const comparisonText = isZh
      ? "较昨日"
      : isFr
        ? "par rapport à hier"
        : "vs yesterday";

    return (
      <div style={{ marginTop: 8, color, fontSize: 12, fontWeight: 600 }}>
        {prefix}
        {amount} {comparisonText}
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          {isZh
            ? "SmartDepanneur Agent - 仪表盘"
            : isFr
              ? "SmartDepanneur Agent - Tableau de bord"
              : "SmartDepanneur Agent - Dashboard"}
        </h2>
        <Button
          type="primary"
          icon={<FileTextOutlined />}
          loading={closeoutLoading}
          onClick={generateDailyCloseout}
        >
          {isZh
            ? "生成今日结算表"
            : isFr
              ? "Générer la clôture du jour"
              : "Generate Daily Closeout"}
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={8} xl={6}>
          <Card loading={loading}>
            <Statistic
              title={
                isZh ? "今日销售" : isFr ? "Ventes du jour" : "Today's Sales"
              }
              value={data?.today.saleCount ?? 0}
              prefix={<ShoppingCartOutlined />}
            />
            {trend &&
              renderDelta(trend.comparison.saleCountDelta, false)}
          </Card>
        </Col>
        <Col xs={12} md={8} xl={6}>
          <Card loading={loading}>
            <Statistic
              title={
                isZh ? "今日收入" : isFr ? "Revenus du jour" : "Today's Revenue"
              }
              value={data ? parseFloat(data.today.revenue).toFixed(2) : "0.00"}
              prefix={<DollarOutlined />}
              suffix="$"
            />
            {trend &&
              renderDelta(trend.comparison.revenueChangePercent)}
          </Card>
        </Col>
        <Col xs={12} md={8} xl={6}>
          <Card loading={loading}>
            <Statistic
              title={
                isZh ? "预估利润" : isFr ? "Profit estimé" : "Estimated Profit"
              }
              value={data ? parseFloat(data.today.profit).toFixed(2) : "0.00"}
              prefix={<LineChartOutlined />}
              suffix="$"
              styles={{ content: { color: "#237804" } }}
            />
            {trend &&
              renderDelta(trend.comparison.profitChangePercent)}
          </Card>
        </Col>
        <Col xs={12} md={8} xl={6}>
          <Card loading={loading}>
            <Statistic
              title={
                isZh ? "今日撤销次数" : isFr ? "Annulations du jour" : "Today's Voids"
              }
              value={data?.today.voidCount ?? 0}
              prefix={<UndoOutlined />}
              styles={{ content: { color: "#cf1322" } }}
            />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={6}>
          <Card loading={loading}>
            <Statistic
              title={
                isZh
                  ? "今日撤销金额"
                  : isFr
                    ? "Montant annulé"
                    : "Voided Amount"
              }
              value={data ? Number(data.today.voidAmount) : 0}
              precision={2}
              prefix="$"
              styles={{ content: { color: "#cf1322" } }}
            />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={6}>
          <Card loading={loading}>
            <Statistic
              title={isZh ? "低库存" : isFr ? "Stock bas" : "Low Stock"}
              value={data?.products.lowStock ?? 0}
              prefix={<AlertOutlined />}
              styles={
                data && data.products.lowStock > 0
                  ? { content: { color: "#cf1322" } }
                  : undefined
              }
            />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={6}>
          <Card loading={loading}>
            <Statistic
              title={
                isZh ? "即将过期" : isFr ? "Expire bientôt" : "Expiring Soon"
              }
              value={data?.products.expiringSoon ?? 0}
              prefix={<ClockCircleOutlined />}
              styles={
                data && data.products.expiringSoon > 0
                  ? { content: { color: "#d48806" } }
                  : undefined
              }
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={8}>
          <Card
            loading={loading}
            title={
              isZh
                ? "分类销售占比"
                : isFr
                  ? "Ventes par catégorie"
                  : "Category Sales Mix"
            }
            style={{ height: "100%" }}
          >
            <DonutChart
              slices={categorySlices("revenue")}
              centerValue={formatCurrency(closeout?.totals.subtotal ?? 0)}
              centerLabel={
                isZh
                  ? "税前销售额"
                  : isFr
                    ? "Ventes avant taxes"
                    : "Sales Before Tax"
              }
              emptyText={
                isZh
                  ? "今日暂无销售"
                  : isFr
                    ? "Aucune vente"
                    : "No Sales Today"
              }
              valueFormatter={formatCurrency}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            loading={loading}
            title={
              isZh
                ? "近 7 日收入与毛利"
                : isFr
                  ? "Revenus et profit sur 7 jours"
                  : "7-Day Revenue & Profit"
            }
            style={{ height: "100%" }}
          >
            <SalesTrendChart
              points={trend?.points ?? []}
              locale={locale}
              valueFormatter={formatCurrency}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            loading={loading}
            title={
              isZh
                ? "分类销售与毛利对比"
                : isFr
                  ? "Ventes et profit par catégorie"
                  : "Category Sales vs Profit"
            }
            style={{ height: "100%" }}
          >
            <CategoryPerformanceChart
              categories={closeout?.categories ?? []}
              locale={locale}
              valueFormatter={formatCurrency}
              labelFormatter={(label) =>
                localizeStoreCategory(label, locale)
              }
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card
            title={
              isZh
                ? "低库存提醒"
                : isFr
                  ? "Alerte de stock bas"
                  : "Low Stock Alert"
            }
            loading={loading}
            extra={
              <Button size="small" type="link" href="/inventory">
                {isZh
                  ? "查看库存"
                  : isFr
                    ? "Voir l’inventaire"
                    : "View Inventory"}
              </Button>
            }
          >
            <Table
              size="small"
              dataSource={data?.lowStockList ?? []}
              columns={lowStockColumns}
              rowKey="id"
              pagination={false}
              locale={{
                emptyText: isZh
                  ? "所有商品库存充足"
                  : isFr
                    ? "Tous les produits ont un stock suffisant"
                    : "All products are sufficiently stocked",
              }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title={
              isZh
                ? "热销商品（总计）"
                : isFr
                  ? "Meilleures ventes (total)"
                  : "Top Sellers (All Time)"
            }
            loading={loading}
          >
            <Table
              size="small"
              dataSource={data?.topSellers ?? []}
              columns={topSellerColumns}
              rowKey="productId"
              pagination={false}
              locale={{
                emptyText: isZh
                  ? "暂无销售记录"
                  : isFr
                    ? "Aucune vente enregistrée"
                    : "No sales recorded yet",
              }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title={
              isZh
                ? "即将过期商品"
                : isFr
                  ? "Produits bientôt expirés"
                  : "Products Expiring Soon"
            }
            loading={loading}
            extra={
              <Button size="small" type="link" href="/inventory">
                {isZh
                  ? "查看库存"
                  : isFr
                    ? "Voir l’inventaire"
                    : "View Inventory"}
              </Button>
            }
          >
            <Table
              size="small"
              dataSource={data?.expiringList ?? []}
              columns={expiringColumns}
              rowKey="id"
              pagination={false}
              locale={{
                emptyText: isZh
                  ? "未来 7 天没有即将过期商品"
                  : isFr
                    ? "Aucun produit n’expire dans les 7 prochains jours"
                    : "No products expiring in the next 7 days",
              }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card loading={loading}>
            <Statistic
              title={
                isZh ? "启用商品" : isFr ? "Produits actifs" : "Active Products"
              }
              value={data?.products.active ?? 0}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        open={closeoutOpen}
        width={960}
        title={
          closeout
            ? isZh
              ? `${closeout.date} 今日结算表`
              : isFr
                ? `Clôture du ${closeout.date}`
                : `Daily Closeout — ${closeout.date}`
            : undefined
        }
        onCancel={() => setCloseoutOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setCloseoutOpen(false)}>
              {isZh ? "关闭" : isFr ? "Fermer" : "Close"}
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              disabled={!closeout}
              onClick={downloadCloseoutCsv}
            >
              {isZh ? "下载 CSV" : isFr ? "Télécharger CSV" : "Download CSV"}
            </Button>
          </Space>
        }
      >
        {closeout && (
          <>
            <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
              <Col xs={12} md={5}>
                <Card size="small">
                  <Statistic
                    title={isZh ? "订单数" : isFr ? "Ventes" : "Sales"}
                    value={closeout.saleCount}
                  />
                </Card>
              </Col>
              <Col xs={12} md={5}>
                <Card size="small">
                  <Statistic
                    title={
                      isZh
                        ? "税前销售额"
                        : isFr
                          ? "Ventes avant taxes"
                          : "Sales Before Tax"
                    }
                    value={Number(closeout.totals.subtotal)}
                    precision={2}
                    prefix="$"
                  />
                </Card>
              </Col>
              <Col xs={12} md={4}>
                <Card size="small">
                  <Statistic
                    title={isZh ? "税费" : isFr ? "Taxes" : "Tax"}
                    value={Number(closeout.totals.tax)}
                    precision={2}
                    prefix="$"
                  />
                </Card>
              </Col>
              <Col xs={12} md={5}>
                <Card size="small">
                  <Statistic
                    title={
                      isZh
                        ? "今日收入（含税）"
                        : isFr
                          ? "Revenus avec taxes"
                          : "Revenue With Tax"
                    }
                    value={Number(closeout.totals.revenue)}
                    precision={2}
                    prefix="$"
                  />
                </Card>
              </Col>
              <Col xs={12} md={5}>
                <Card size="small">
                  <Statistic
                    title={
                      isZh ? "毛利" : isFr ? "Profit brut" : "Gross Profit"
                    }
                    value={Number(closeout.totals.grossProfit)}
                    precision={2}
                    prefix="$"
                    suffix={`(${Number(closeout.totals.grossMargin).toFixed(2)}%)`}
                    styles={{ content: { color: "#237804" } }}
                  />
                </Card>
              </Col>
            </Row>

            <Table
              size="small"
              dataSource={closeout.categories}
              columns={closeoutColumns}
              rowKey={(row) => row.categoryId ?? "uncategorized"}
              pagination={false}
              scroll={{ x: 720 }}
              locale={{
                emptyText: isZh
                  ? "今日暂无销售记录"
                  : isFr
                    ? "Aucune vente aujourd’hui"
                    : "No sales recorded today",
              }}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <strong>{isZh ? "合计" : isFr ? "Total" : "Total"}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <strong>
                      {closeout.categories.reduce(
                        (sum, row) => sum + row.quantity,
                        0,
                      )}
                    </strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    <strong>{formatCurrency(closeout.totals.subtotal)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <strong>
                      {formatCurrency(closeout.totals.grossProfit)}
                    </strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <strong>
                      {Number(closeout.totals.grossMargin).toFixed(2)}%
                    </strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
            <div style={{ marginTop: 12, color: "#8c8c8c", fontSize: 12 }}>
              {isZh
                ? `营业日按 ${closeout.timeZone} 时区统计；分类销售额为税前金额。`
                : isFr
                  ? `La journée est calculée selon le fuseau ${closeout.timeZone}; les ventes par catégorie sont avant taxes.`
                  : `Business day uses ${closeout.timeZone}; category sales are before tax.`}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
