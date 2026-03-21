import { useState, useEffect } from 'react'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Filler,
} from 'chart.js'
import { municipalityAPI } from '../../services/api'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Filler)

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

const baseOpts = (title) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
    title:  { display: !!title, text: title, color: '#94a3b8', font: { size: 12 } },
  },
  scales: {
    x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(26,58,92,0.4)' } },
    y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(26,58,92,0.4)' } },
  },
})

export default function Analytics() {
  const [zones,      setZones]      = useState([])
  const [compliance, setCompliance] = useState(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    Promise.all([
      municipalityAPI.getZones(),
      municipalityAPI.getCompliance(30),
    ]).then(([z, c]) => {
      setZones(z.data?.zones || [])
      setCompliance(c.data)
    }).finally(() => setLoading(false))
  }, [])

  const monthlyData = {
    labels: MONTHS,
    datasets: [
      {
        label: 'Collections',
        data: [320,380,410,390,450,480,520,490,530,560,510,580],
        backgroundColor: 'rgba(14,165,233,0.6)',
        borderRadius: 4,
      },
      {
        label: 'Violations',
        data: [12,8,15,10,7,9,6,11,8,5,7,4],
        backgroundColor: 'rgba(239,68,68,0.6)',
        borderRadius: 4,
      },
    ],
  }

  const complianceData = {
    labels: DAYS,
    datasets: [{
      label: 'Compliance Score',
      data: [94,96,91,98,95,97,93],
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#10b981',
    }],
  }

  const citizenData = {
    labels: MONTHS,
    datasets: [{
      label: 'Active Citizens',
      data: [120,145,160,180,210,240,280,310,340,380,420,460],
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#f59e0b',
    }],
  }

  const wasteTypeData = {
    labels: ['General','Recyclable','Organic','Hazardous','Electronic'],
    datasets: [{
      data: [35,28,20,10,7],
      backgroundColor: ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6'],
      borderWidth: 0,
    }],
  }

  const zoneData = {
    labels: zones.slice(0,8).map((z) => z.zone),
    datasets: [
      {
        label: 'Avg Fill %',
        data: zones.slice(0,8).map((z) => z.avg_fill),
        backgroundColor: zones.slice(0,8).map((z) => z.avg_fill >= 80 ? 'rgba(239,68,68,0.7)' : z.avg_fill >= 50 ? 'rgba(245,158,11,0.7)' : 'rgba(16,185,129,0.7)'),
        borderRadius: 4,
      },
    ],
  }

  if (loading) return <div className="flex justify-center py-20"><div className="spinner spinner-lg" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">ANALYTICS</h1>
        <p className="text-xs text-txt-secondary mt-1">System-wide performance metrics and trends</p>
      </div>

      {/* Compliance summary */}
      {compliance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Compliance Rate',    value: `${compliance.compliance_rate_pct}%`,  color: 'text-accent-green' },
            { label: 'Total Events (30d)', value: compliance.total_collection_events,    color: 'text-accent-blue'  },
            { label: 'Total Violations',   value: compliance.total_violations,           color: 'text-critical'     },
            { label: 'Total Penalties',    value: `$${compliance.total_penalty_usd}`,    color: 'text-warning'      },
          ].map((m) => (
            <div key={m.label} className="card card-accent-blue text-center">
              <div className={`text-2xl font-black ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-txt-secondary mt-1">{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card card-accent-blue">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-4">MONTHLY COLLECTIONS & VIOLATIONS</h3>
          <div style={{ height: 220 }}><Bar data={monthlyData} options={baseOpts()} /></div>
        </div>
        <div className="card card-accent-green">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-4">DAILY COMPLIANCE SCORE (7 DAYS)</h3>
          <div style={{ height: 220 }}><Line data={complianceData} options={baseOpts()} /></div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card card-accent-gold xl:col-span-2">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-4">ZONE PERFORMANCE (AVG FILL %)</h3>
          <div style={{ height: 220 }}>
            {zones.length > 0
              ? <Bar data={zoneData} options={baseOpts()} />
              : <div className="flex items-center justify-center h-full text-txt-secondary text-sm">No zone data available</div>
            }
          </div>
        </div>
        <div className="card card-accent-purple">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-4">WASTE TYPE DISTRIBUTION</h3>
          <div style={{ height: 220 }}>
            <Doughnut data={wasteTypeData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 }, padding: 8 } } }, cutout: '60%' }} />
          </div>
        </div>
      </div>

      {/* Citizen participation */}
      <div className="card card-accent-gold">
        <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-4">CITIZEN PARTICIPATION GROWTH</h3>
        <div style={{ height: 200 }}><Line data={citizenData} options={baseOpts()} /></div>
      </div>
    </div>
  )
}
