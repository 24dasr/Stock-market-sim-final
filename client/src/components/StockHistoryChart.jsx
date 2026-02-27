import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

// Simple color palette for line series
const COLORS = [
    '#00FF7F', // accent-green
    '#FF4500', // accent-red
    '#FFD700', // accent-gold
    '#1E90FF', // dodgerblue
    '#FF1493', // deeppink
    '#00FFFF', // cyan
    '#9400D3', // darkviolet
    '#FFA500', // orange
];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const timeStr = new Date(label).toLocaleTimeString();
        return (
            <div className="bg-base-lighter p-3 border border-border rounded shadow-lg text-sm">
                <p className="text-text-secondary mb-2">{timeStr}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 mb-1">
                        <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        ></span>
                        <span className="text-text-primary font-medium">{entry.name}:</span>
                        <span className="text-text-primary font-bold">
                            ${Number(entry.value).toFixed(2)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export default function StockHistoryChart({ historyData }) {
    if (!historyData || historyData.length === 0) {
        return (
            <div className="card text-center py-12 flex-1 flex flex-col items-center justify-center min-h-[300px]">
                <div className="text-4xl mb-3">📈</div>
                <p className="text-text-secondary font-heading">No history data available</p>
                <p className="text-text-secondary text-sm mt-1">
                    Stock values will be graphed here once trading begins
                </p>
            </div>
        );
    }

    // Transform data format from: [{ companyId, price, timestamp, company: {name} }]
    // To: [{ timestamp, "Company A": 10, "Company B": 12 }]
    const chartDataMap = new Map();
    const companyNames = new Set();

    historyData.forEach((record) => {
        // Group by timestamp string for the X-axis
        // For a real-time simulator where multiple updates can happen near the same time,
        // we can use a small time-window or just use raw timestamps if they map cleanly.
        // Here we use the timestamp string. Let's round to the nearest second to group them
        // nicely, or just use the raw ISO string depending on frequency.

        // Instead of raw ISO string, just use ISO string slice up to seconds
        const tsStr = new Date(record.timestamp).toISOString().slice(0, 19);

        if (!chartDataMap.has(tsStr)) {
            chartDataMap.set(tsStr, { time: new Date(record.timestamp).getTime() });
        }
        const dataPoint = chartDataMap.get(tsStr);
        const compName = record.company?.name || `Company ${record.companyId}`;
        dataPoint[compName] = record.price;
        companyNames.add(compName);
    });

    const chartData = Array.from(chartDataMap.values()).sort((a, b) => a.time - b.time);

    // We need to forward-fill missing values if a company didn't have an update at a specific second
    // to ensure continuous lines.
    let prevValues = {};
    chartData.forEach(point => {
        companyNames.forEach(name => {
            if (point[name] === undefined && prevValues[name] !== undefined) {
                point[name] = prevValues[name]; // forward fill
            } else if (point[name] !== undefined) {
                prevValues[name] = point[name];
            }
        });
    });

    const companiesList = Array.from(companyNames);

    return (
        <div className="card w-full h-[400px]">
            <h3 className="font-heading font-semibold text-text-primary mb-4">Stock Value History</h3>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#252a36" />
                    <XAxis
                        dataKey="time"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        stroke="#a1a1aa"
                        tick={{ fontSize: 12 }}
                    />
                    <YAxis
                        stroke="#a1a1aa"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(val) => `$${val}`}
                        domain={['auto', 'auto']}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    {companiesList.map((name, index) => (
                        <Line
                            key={name}
                            type="monotone"
                            dataKey={name}
                            stroke={COLORS[index % COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
