import React from "react";
import { Link } from "react-router-dom";
const features = [
  { title: "Regional heat monitoring", desc: "Compare reported maximum temperatures, departures from normal, and regional severity.", tab: "regions", number: "01" },
  { title: "Field decision support", desc: "Review stored sensor readings and rule-based irrigation recommendations for each plot.", tab: "field", number: "02" },
  { title: "Observation records", desc: "Submit validated field observations and review reports saved by the backend.", tab: "reports", number: "03" },
  { title: "Public weather forecast", desc: "Request daily maximum temperatures from the connected Open-Meteo weather service.", tab: "forecast", number: "04" },
];
export default function Home() {
  return <>
    <section className="hero container">
      <div><span className="eyebrow mono">CLIMATE OBSERVATION WORKSPACE</span><h1>Clear observations.<br /><span className="accent-text">Better field decisions.</span></h1><p>Explore regional heat conditions, inspect field telemetry, and keep observations together. See the source and timestamp of readings before taking action.</p><div className="hero-ctas"><Link to="/dashboard" className="btn btn-primary">Open dashboard ↗</Link><Link to="/report" className="btn btn-ghost">Report an observation</Link></div></div>
      <div className="workflow-card"><span className="eyebrow mono">YOUR OPERATIONAL WORKFLOW</span>{[["Observe", "Review regional readings and field sensors."], ["Assess", "Inspect severity and plot recommendations."], ["Record", "Save observations and regional alerts."]].map(([title, description], index) => <div className="workflow-step" key={title}><span className="workflow-number mono">0{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></div>)}<Link to="/dashboard?tab=field" className="workflow-link">Explore field monitoring →</Link></div>
    </section>
    <section className="section container"><span className="eyebrow mono">CONNECTED WORKSPACE</span><h2 className="section-title">From observations to action</h2><p className="section-sub">Regional and field records are served by the project backends. Public forecasts are fetched when requested.</p><div className="card-grid">{features.map((feature) => <Link className="feature-card feature-link" key={feature.tab} to={`/dashboard?tab=${feature.tab}`}><span className="feature-number mono">{feature.number}</span><h3>{feature.title}</h3><p>{feature.desc}</p><span className="feature-arrow" aria-hidden="true">↗</span></Link>)}</div></section>
    <section className="final-cta"><div className="container"><h2 className="section-title">Keep your field observations connected.</h2><p>Record an observation with validation, then review it in the dashboard.</p><Link className="btn btn-primary" to="/report">Create an observation</Link></div></section>
  </>;
}
