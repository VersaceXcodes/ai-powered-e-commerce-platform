import React, { useState, useMemo, useEffect, useRef } from "react";
import { useAppStore } from "@/store/main";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { analyticsSnapshotSchema } from "@schema";
import type { AnalyticsSnapshot } from "@schema";
import { Link } from "react-router-dom";

// ---- CONSTANTS ----
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const SNAPSHOT_LIMIT = 24;

// Date Ranges (can extend in future)
const DATE_RANGE_PRESETS = [
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "", label: "All time" },
];

// --- SIMPLE MINI-CHART RENDERERS ---
// Only use JSX/SVG/Tailwind (no external libs)
function LineChart({ data, yKey = "value", color = "blue" }: {
  data: { [k: string]: any }[];
  yKey: string;
  color?: string;
}) {

  // Defensive: ensure >1 point
  if (!data || data.length < 2) {
    return (
      <svg viewBox="0 0 120 40" className="w-full h-12">
        <text x="50%" y="60%" textAnchor="middle" fontSize="10" fill="#888">
          n/a
        </text>
      </svg>
    );
  }
  // Scale to 0-100, get y min/max for chart scaling
  const values = data.map(d => Number(d[yKey] ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 5;
  const w = 120, h = 40;
  const points = data.map((d, i) => {
    const x = pad + ((w - 2 * pad) * i) / (data.length - 1);
    const y = h - pad - ((h - 2 * pad) * (Number(d[yKey]) - min)) / range;
    return [x, y];
  });
  const colorMap = {
    blue: "#2563eb",
    green: "#16a34a",
    orange: "#f59e42",
    red: "#dc2626",
    indigo: "#6366f1",
    gray: "#6b7280",
  };
  const path = points.map(([x, y], i) =>
    i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
  ).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" aria-hidden>
      <polyline
        fill="none"
        stroke={colorMap[color] || "#2563eb"}
        strokeWidth="2"
        points={points.map(([x, y]) => `${x},${y}`).join(" ")}
        opacity=".8"
      />
      <path d={path} fill="none" stroke={colorMap[color] || "#2563eb"} strokeWidth="2" />
      {/* dots */}
      {points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="2"
          fill={colorMap[color] || "#2563eb"}
          className="opacity-90"
        />
      ))}
    </svg>
  );
}

// ---- ANALYTICS QUERY ----
const analyticsSnapshotListResponseSchema = z.object({
  analytics_snapshots: z.array(analyticsSnapshotSchema),
  total: z.number(),
});

const fetchAnalyticsSnapshots = async ({
  token,
  dateRange,
}: {
  token: string;
  dateRange: string;
}): Promise<AnalyticsSnapshot[]> => {
  const resp = await axios.get(`${API_BASE}/admin/analytics`, {
    params: {
      date_range: dateRange || undefined,
      sort_by: "created_at",
      sort_order: "desc",
      limit: SNAPSHOT_LIMIT,
    },
    headers: { Authorization: `Bearer ${token}` },
  });
  const parsed = analyticsSnapshotListResponseSchema.safeParse(resp.data);
  if (!parsed.success) throw new Error("Invalid analytics response");
  // Sorted DESC from backend. Render left-to-right old->new (reverse).
  return [...parsed.data.analytics_snapshots].reverse();
};

// ---- MAIN COMPONENT ----
const UV_Admin_Analytics: React.FC = () => {
  // CRITICAL: Individual Zustand selectors only!
  const token = useAppStore((s) => s.authentication_state.auth_token);
  const socket = useAppStore((s) => s.socket);

  // Local state
  const [selectedDateRange, setSelectedDateRange] = useState<string>(DATE_RANGE_PRESETS[0].value);
  const [chartDrilldown, setChartDrilldown] = useState<{ metric: string; extra?: any } | null>(null);
  const {
    data: analyticsSnapshots = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<AnalyticsSnapshot[], Error>({
    queryKey: ["admin_analytics", selectedDateRange],
    queryFn: () => {
      if (!token) throw new Error("No token");
      return fetchAnalyticsSnapshots({ token, dateRange: selectedDateRange });
    },
    staleTime: 60_000,
  });

  // Realtime event: force refetch when relevant socket event happens
  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    if (!socket) return;
    // Use a non-intrusive event handler (not managed by Zustand directly)
    const handler = () => {
      if (isMounted.current) refetch();
    };
    socket.on("admin.analytics.updated", handler);
    return () => {
      isMounted.current = false;
      socket && socket.off("admin.analytics.updated", handler);
    };
    // eslint-disable-next-line
  }, [socket, refetch]);

  // ---- Derived Data Preparation ----
  // Time X axis (sort: old -> newest)
  const timeLabels = useMemo(
    () =>
      analyticsSnapshots.map((snap) =>
        snap.date_range
          ? snap.date_range
          : new Date(snap.created_at).toLocaleDateString()
      ),
    [analyticsSnapshots]
  );
  // Metric series for charts
  const revenueSeries = useMemo(
    () =>
      analyticsSnapshots.map((snap, i) => ({
        label: timeLabels[i],
        value: snap.revenue_total,
        snapshot_id: snap.snapshot_id,
      })),
    [analyticsSnapshots, timeLabels]
  );
  const avgOrderValueSeries = useMemo(
    () =>
      analyticsSnapshots.map((snap, i) => ({
        label: timeLabels[i],
        value: snap.avg_order_value,
        snapshot_id: snap.snapshot_id,
      })),
    [analyticsSnapshots, timeLabels]
  );
  const totalOrdersSeries = useMemo(
    () =>
      analyticsSnapshots.map((snap, i) => ({
        label: timeLabels[i],
        value: snap.total_orders,
        snapshot_id: snap.snapshot_id,
      })),
    [analyticsSnapshots, timeLabels]
  );
  const lowInventorySeries = useMemo(
    () =>
      analyticsSnapshots.map((snap, i) => ({
        label: timeLabels[i],
        value: snap.inventory_low_count,
        snapshot_id: snap.snapshot_id,
      })),
    [analyticsSnapshots, timeLabels]
  );
  const userRegistrationSeries = useMemo(
    () =>
      analyticsSnapshots.map((snap, i) => ({
        label: timeLabels[i],
        value: snap.user_registration_count,
        snapshot_id: snap.snapshot_id,
      })),
    [analyticsSnapshots, timeLabels]
  );

  // --- Most Recent Snapshot (latest date) ---
  const latest = analyticsSnapshots.length > 0 ? analyticsSnapshots[analyticsSnapshots.length - 1] : null;

  // --- Misc Handlers ---
  const handleDateRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDateRange(e.target.value);
  };
  const openDrilldown = (metric: string, extra?: any) => {
    setChartDrilldown({ metric, extra });
  };
  const closeDrilldown = () => {
    setChartDrilldown(null);
  };
  // Manual refresh
  const handleManualRefresh = () => refetch();

  return (
    <>
      <div className="min-h-screen bg-slate-50 py-8 px-2 sm:px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-100">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                Analytics Dashboard
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Platform KPIs and business metrics. Click on a card/chart for details or to drill down.
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <select
                className="border-gray-300 rounded-md py-1 px-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                value={selectedDateRange}
                onChange={handleDateRangeChange}
                aria-label="Select analytics date range"
              >
                {DATE_RANGE_PRESETS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <button
                onClick={handleManualRefresh}
                disabled={isFetching}
                className="ml-1 inline-flex items-center px-2.5 py-1.5 border border-blue-600 text-sm rounded-md text-blue-700 bg-white hover:bg-blue-100 focus:ring-2 ring-blue-300 focus:outline-none disabled:opacity-60"
                aria-label="Refresh analytics"
                tabIndex={0}
                type="button"
              >
                <svg className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4v5h.582M19 11a7.5 7.5 0 11-2.457-5.323" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="ml-1">Refresh</span>
              </button>
            </div>
          </div>

          {isError && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded" aria-live="polite">
              <span>Error loading analytics: {error instanceof Error ? error.message : String(error)}</span>
            </div>
          )}
          {isLoading || isFetching ? (
            <div className="flex flex-col items-center justify-center min-h-[200px]">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-2"></div>
              <span className="text-blue-700">Loading analytics...</span>
            </div>
          ) : (
            analyticsSnapshots.length === 0 ? (
              <div className="text-center text-gray-500 py-12" aria-live="polite">
                <span>No analytics data available.</span>
              </div>
            ) : (
              <>
                {/* --- METRICS CARDS --- */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 mb-8">
                  {/* Revenue */}
                  <div
                    className="bg-white rounded-lg shadow border cursor-pointer hover:shadow-lg focus:ring-2 ring-blue-200 transition outline-none"
                    tabIndex={0}
                    aria-label={`Total Revenue: $${latest?.revenue_total.toLocaleString()}`}
                    onClick={() => openDrilldown('revenue_total', { series: revenueSeries })}
                    onKeyDown={e => { if (e.key === 'Enter') openDrilldown('revenue_total', { series: revenueSeries }); }}
                  >
                    <div className="p-4">
                      <div className="flex items-center mb-2">
                        <span className="block mr-2 text-lg font-semibold text-blue-700">${
                          latest ? latest.revenue_total.toLocaleString("en-US", { maximumFractionDigits: 2 }) : '--'
                        }</span>
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">Revenue</span>
                        <button
                          aria-label="Show revenue trend"
                          onClick={e => { e.stopPropagation(); openDrilldown('revenue_total', { series: revenueSeries }); }}
                          tabIndex={-1}
                          className="ml-auto focus:outline-none p-1"
                          type="button"
                        >
                          <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 19 19"><circle cx="9.5" cy="9.5" r="8.5" stroke="currentColor" /><line x1="9.5" y1="5" x2="9.5" y2="9.5" stroke="currentColor" strokeLinecap="round"/><circle cx="9.5" cy="13.5" r="1" fill="currentColor" /></svg>
                        </button>
                      </div>
                      <div className="mb-0">
                        <LineChart data={revenueSeries} yKey="value" color="blue" />
                      </div>
                    </div>
                    <Link
                      to="/admin/orders"
                      className="block text-[10px] text-right text-blue-500 pr-3 pb-1 hover:underline focus:underline"
                      tabIndex={0}
                    >View Orders</Link>
                  </div>
                  {/* Avg Order Value */}
                  <div
                    className="bg-white rounded-lg shadow border cursor-pointer hover:shadow-lg focus:ring-2 ring-green-200 transition outline-none"
                    tabIndex={0}
                    aria-label={`Average Order Value: $${latest?.avg_order_value.toLocaleString()}`}
                    onClick={() => openDrilldown('avg_order_value', { series: avgOrderValueSeries })}
                    onKeyDown={e => { if (e.key === 'Enter') openDrilldown('avg_order_value', { series: avgOrderValueSeries }); }}
                  >
                    <div className="p-4">
                      <div className="flex items-center mb-2">
                        <span className="block mr-2 text-lg font-semibold text-green-700">
                          {latest ? latest.avg_order_value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : '--'}
                        </span>
                        <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">Avg. Order</span>
                        <button
                          aria-label="Show average order value trend"
                          onClick={e => { e.stopPropagation(); openDrilldown('avg_order_value', { series: avgOrderValueSeries }); }}
                          tabIndex={-1}
                          className="ml-auto focus:outline-none p-1"
                          type="button"
                        >
                          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 19 19"><circle cx="9.5" cy="9.5" r="8.5" stroke="currentColor" /><line x1="9.5" y1="5" x2="9.5" y2="9.5" stroke="currentColor" strokeLinecap="round"/><circle cx="9.5" cy="13.5" r="1" fill="currentColor" /></svg>
                        </button>
                      </div>
                      <LineChart data={avgOrderValueSeries} yKey="value" color="green" />
                    </div>
                    <Link
                      to="/admin/orders"
                      className="block text-[10px] text-right text-green-500 pr-3 pb-1 hover:underline focus:underline"
                      tabIndex={0}
                    >View Orders</Link>
                  </div>
                  {/* Total Orders */}
                  <div
                    className="bg-white rounded-lg shadow border cursor-pointer hover:shadow-lg focus:ring-2 ring-indigo-200 transition outline-none"
                    tabIndex={0}
                    aria-label={`Total Orders: ${latest?.total_orders ?? '--'}`}
                    onClick={() => openDrilldown('total_orders', { series: totalOrdersSeries })}
                    onKeyDown={e => { if (e.key === 'Enter') openDrilldown('total_orders', { series: totalOrdersSeries }); }}
                  >
                    <div className="p-4">
                      <div className="flex items-center mb-2">
                        <span className="block mr-2 text-lg font-semibold text-indigo-700">
                          {latest ? latest.total_orders : '--'}
                        </span>
                        <span className="inline-block bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full">Orders</span>
                        <button
                          aria-label="Show orders trend"
                          onClick={e => { e.stopPropagation(); openDrilldown('total_orders', { series: totalOrdersSeries }); }}
                          tabIndex={-1}
                          className="ml-auto focus:outline-none p-1"
                          type="button"
                        >
                          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 19 19"><circle cx="9.5" cy="9.5" r="8.5" stroke="currentColor" /><line x1="9.5" y1="5" x2="9.5" y2="9.5" stroke="currentColor" strokeLinecap="round"/><circle cx="9.5" cy="13.5" r="1" fill="currentColor" /></svg>
                        </button>
                      </div>
                      <LineChart data={totalOrdersSeries} yKey="value" color="indigo" />
                    </div>
                    <Link
                      to="/admin/orders"
                      className="block text-[10px] text-right text-indigo-500 pr-3 pb-1 hover:underline focus:underline"
                      tabIndex={0}
                    >Orders Table</Link>
                  </div>
                  {/* Inventory Low */}
                  <div
                    className="bg-white rounded-lg shadow border cursor-pointer hover:shadow-lg focus:ring-2 ring-orange-200 transition outline-none"
                    tabIndex={0}
                    aria-label={`Low Inventory: ${latest?.inventory_low_count ?? '--'} products`}
                    onClick={() => openDrilldown('inventory_low_count', { series: lowInventorySeries })}
                    onKeyDown={e => { if (e.key === 'Enter') openDrilldown('inventory_low_count', { series: lowInventorySeries }); }}
                  >
                    <div className="p-4">
                      <div className="flex items-center mb-2">
                        <span className="block mr-2 text-lg font-semibold text-orange-700">
                          {latest ? latest.inventory_low_count : '--'}
                        </span>
                        <span className="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded-full">Low Inv</span>
                        <button
                          aria-label="Show inventory warning trend"
                          onClick={e => { e.stopPropagation(); openDrilldown('inventory_low_count', { series: lowInventorySeries }); }}
                          tabIndex={-1}
                          className="ml-auto focus:outline-none p-1"
                          type="button"
                        >
                          <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 19 19"><circle cx="9.5" cy="9.5" r="8.5" stroke="currentColor" /><line x1="9.5" y1="5" x2="9.5" y2="9.5" stroke="currentColor" strokeLinecap="round"/><circle cx="9.5" cy="13.5" r="1" fill="currentColor" /></svg>
                        </button>
                      </div>
                      <LineChart data={lowInventorySeries} yKey="value" color="orange" />
                    </div>
                    <Link
                      to="/admin/products"
                      className="block text-[10px] text-right text-orange-500 pr-3 pb-1 hover:underline focus:underline"
                      tabIndex={0}
                    >Product Inventory</Link>
                  </div>
                  {/* User Signups */}
                  <div
                    className="bg-white rounded-lg shadow border cursor-pointer hover:shadow-lg focus:ring-2 ring-gray-200 transition outline-none"
                    tabIndex={0}
                    aria-label={`New user registrations: ${latest?.user_registration_count ?? '--'}`}
                    onClick={() => openDrilldown('user_registration_count', { series: userRegistrationSeries })}
                    onKeyDown={e => { if (e.key === 'Enter') openDrilldown('user_registration_count', { series: userRegistrationSeries }); }}
                  >
                    <div className="p-4">
                      <div className="flex items-center mb-2">
                        <span className="block mr-2 text-lg font-semibold text-gray-700">
                          {latest ? latest.user_registration_count : '--'}
                        </span>
                        <span className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded-full">Signups</span>
                        <button
                          aria-label="Show user signups trend"
                          onClick={e => { e.stopPropagation(); openDrilldown('user_registration_count', { series: userRegistrationSeries }); }}
                          tabIndex={-1}
                          className="ml-auto focus:outline-none p-1"
                          type="button"
                        >
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 19 19"><circle cx="9.5" cy="9.5" r="8.5" stroke="currentColor" /><line x1="9.5" y1="5" x2="9.5" y2="9.5" stroke="currentColor" strokeLinecap="round"/><circle cx="9.5" cy="13.5" r="1" fill="currentColor" /></svg>
                        </button>
                      </div>
                      <LineChart data={userRegistrationSeries} yKey="value" color="gray" />
                    </div>
                    <Link
                      to="/admin/users"
                      className="block text-[10px] text-right text-gray-500 pr-3 pb-1 hover:underline focus:underline"
                      tabIndex={0}
                    >User Table</Link>
                  </div>
                </div>

                {/* --- "Drilldown" Modal --- */}
                {chartDrilldown &&
                  <div tabIndex={-1} aria-modal="true" role="dialog" className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center" onClick={closeDrilldown}>
                    <div
                      className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative z-50"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        className="absolute top-2 right-2 text-gray-400 hover:text-gray-700"
                        aria-label="Close detail dialog"
                        onClick={closeDrilldown}
                        tabIndex={0}
                        type="button"
                      >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
                          <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <h2 className="text-lg font-bold mb-2 capitalize">{chartDrilldown.metric.replace(/_/g," ")} - Trend</h2>
                      <div className="mb-3">
                        <LineChart
                          data={chartDrilldown.extra?.series || []}
                          yKey="value"
                          color={
                            chartDrilldown.metric === "revenue_total"
                              ? "blue"
                              : chartDrilldown.metric === "avg_order_value"
                              ? "green"
                              : chartDrilldown.metric === "total_orders"
                              ? "indigo"
                              : chartDrilldown.metric === "inventory_low_count"
                              ? "orange"
                              : "gray"
                          }
                        />
                        <ul className="mt-3 max-h-32 overflow-y-auto text-xs text-gray-700 space-y-1">
                          {(chartDrilldown.extra?.series || []).map((data: any, idx: number) => (
                            <li key={idx}>
                              <span className="font-semibold">{data.label}:</span>{" "}
                              {typeof data.value === "number"
                                ? data.value.toLocaleString()
                                : data.value}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button
                        className="w-full bg-blue-500 mt-2 text-white rounded-md px-4 py-1.5 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                        onClick={closeDrilldown}
                        type="button"
                      >Close</button>
                    </div>
                  </div>}

                {/* --- Export DOWNLOAD UI --- */}
                <div className="flex items-baseline justify-end mt-5">
                  <button
                    className="flex items-center px-3 py-1.5 border border-gray-200 text-gray-400 bg-gray-50 rounded shadow hover:bg-gray-100 cursor-not-allowed"
                    aria-label="Export as CSV (coming soon)"
                    disabled
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24"><path d="M4 4v16h16V4H4zm8 8v5m0 0l-2-2m2 2l2-2m-8-9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Export CSV
                  </button>
                  <span className="text-[10px] ml-2 text-gray-400">(Export coming soon)</span>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </>
  );
};

export default UV_Admin_Analytics;