from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.agents.iot_simulator import run_iot_simulation
from app.agents.prediction_agent import run_prediction_agent
from app.agents.route_agent import run_route_agent
from app.agents.compliance_agent import run_compliance_agent
from app.agents.blockchain_agent import run_blockchain_agent

scheduler = AsyncIOScheduler()


def start_scheduler():
    scheduler.add_job(run_iot_simulation,    IntervalTrigger(minutes=5),  id="iot_agent",         replace_existing=True)
    scheduler.add_job(run_prediction_agent,  IntervalTrigger(minutes=15), id="prediction_agent",  replace_existing=True)
    scheduler.add_job(run_route_agent,       IntervalTrigger(minutes=30), id="route_agent",        replace_existing=True)
    scheduler.add_job(run_compliance_agent,  IntervalTrigger(minutes=60), id="compliance_agent",   replace_existing=True)
    scheduler.add_job(run_blockchain_agent,  IntervalTrigger(minutes=10), id="blockchain_agent",   replace_existing=True)
    scheduler.start()
    print("[Scheduler] All 5 agents started.")


def stop_scheduler():
    scheduler.shutdown(wait=False)
    print("[Scheduler] Stopped.")
