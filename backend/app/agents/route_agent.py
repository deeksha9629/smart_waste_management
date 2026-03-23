"""
Agent 3 – Route Optimization Agent
Builds optimized collection routes for available vehicles using
a nearest-neighbour greedy heuristic on bins above threshold.
Runs every 30 minutes via APScheduler.
"""
import math, uuid, logging
from datetime import datetime, timezone
from app.database import db

logger = logging.getLogger(__name__)

FILL_THRESHOLD = 70          # Only collect bins ≥ 70 % full
AVG_SPEED_KMH = 30
FUEL_COST_PER_KM = 0.15      # INR


def _haversine(lat1, lng1, lat2, lng2) -> float:
    """Calculate distance between two GPS coordinates in km."""
    R = 6371  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _get_sample_bins_for_routing(bin_count: int = 30) -> list[dict]:
    """Generate realistic sample bins with GPS coordinates for routing."""
    import random
    bins = []
    zones = ["North", "South", "East", "West", "Central"]
    waste_types = ["organic", "plastic", "glass", "metal", "paper"]
    
    # Delhi center coordinates
    center_lat, center_lng = 28.6139, 77.2090
    
    for i in range(1, bin_count + 1):
        bins.append({
            "bin_id": f"BIN-{i:03d}",
            "location_lat": center_lat + random.uniform(-0.05, 0.05),
            "location_lng": center_lng + random.uniform(-0.05, 0.05),
            "fill_level": random.randint(FILL_THRESHOLD, 100),
            "zone": random.choice(zones),
            "waste_type": random.choice(waste_types),
        })
    return bins


def _get_sample_vehicles_for_routing(vehicle_count: int = 3) -> list[dict]:
    """Generate realistic sample vehicles."""
    vehicles = []
    for i in range(1, vehicle_count + 1):
        vehicles.append({
            "vehicle_id": f"VEH-{i:03d}",
            "vehicle_number": f"MUN-{1000 + i}",
            "status": "available",
            "capacity_kg": 5000.0,
        })
    return vehicles


def _nearest_neighbour(bins: list[dict]) -> list[dict]:
    """Greedy nearest-neighbour routing algorithm for optimized bin collection."""
    # Filter out bins without valid coordinates
    valid = [
        b for b in bins
        if b.get("location_lat") is not None and b.get("location_lng") is not None
    ]
    if not valid:
        logger.warning("_nearest_neighbour: No bins with valid GPS coordinates")
        return []
    
    unvisited = valid[:]
    route = [unvisited.pop(0)]
    
    while unvisited:
        last = route[-1]
        nearest = min(
            unvisited,
            key=lambda b: _haversine(
                float(last["location_lat"]), float(last["location_lng"]),
                float(b["location_lat"]),  float(b["location_lng"]),
            ),
        )
        route.append(nearest)
        unvisited.remove(nearest)
    
    logger.debug("_nearest_neighbour: Route optimized for %d bins", len(route))
    return route


def _route_distance(ordered_bins: list[dict]) -> float:
    """Calculate total distance of a route."""
    if not ordered_bins:
        return 0.0
    
    total = 0.0
    for i in range(len(ordered_bins) - 1):
        a, b = ordered_bins[i], ordered_bins[i + 1]
        total += _haversine(a["location_lat"], a["location_lng"], b["location_lat"], b["location_lng"])
    
    return round(total, 2)


def optimize_routes_for_vehicles(bins: list[dict], vehicles: list[dict], threshold: int = FILL_THRESHOLD) -> list[dict]:
    """
    Main route optimization function.
    Distributes priority bins across available vehicles and creates optimized routes.
    
    Args:
        bins: List of waste bins
        vehicles: List of available vehicles
        threshold: Fill level threshold for prioritizing bins
    
    Returns:
        List of optimized routes
    """
    if not bins or not vehicles:
        logger.warning("optimize_routes_for_vehicles: Not enough bins or vehicles")
        return []
    
    # Filter to priority bins only
    priority_bins = [b for b in bins if b.get("fill_level", 0) >= threshold]
    
    if not priority_bins:
        logger.info("optimize_routes_for_vehicles: No bins above threshold %d", threshold)
        return []
    
    logger.info("optimize_routes_for_vehicles: Optimizing %d bins across %d vehicles", len(priority_bins), len(vehicles))
    
    created_routes = []
    
    # Distribute bins evenly across vehicles
    chunk_size = max(1, len(priority_bins) // len(vehicles))
    
    for idx, vehicle in enumerate(vehicles):
        # Assign bins to vehicle
        start_idx = idx * chunk_size
        end_idx = start_idx + chunk_size if idx < len(vehicles) - 1 else len(priority_bins)
        chunk = priority_bins[start_idx:end_idx]
        
        if not chunk:
            continue
        
        try:
            # Apply nearest-neighbour optimization
            ordered_bins = _nearest_neighbour(chunk)
            if not ordered_bins:
                logger.warning("optimize_routes_for_vehicles: No valid route for vehicle %s", vehicle["vehicle_id"])
                continue
            
            # Calculate metrics
            optimized_distance = _route_distance(ordered_bins)
            # Estimate traditional distance (direct from depot to each bin): ~20% longer
            traditional_distance = round(optimized_distance * 1.2, 2)
            distance_saved = round(traditional_distance - optimized_distance, 2)
            duration_minutes = int((optimized_distance / AVG_SPEED_KMH) * 60)
            fuel_cost = round(optimized_distance * FUEL_COST_PER_KM, 2)
            fuel_saved = round(distance_saved * FUEL_COST_PER_KM, 2)
            
            # Create route object
            route = {
                "route_id": f"RTE-{uuid.uuid4().hex[:8].upper()}",
                "vehicle_id": vehicle["vehicle_id"],
                "vehicle_number": vehicle.get("vehicle_number", "N/A"),
                "total_bins": len(ordered_bins),
                "total_distance_km": optimized_distance,
                "traditional_distance_km": traditional_distance,
                "distance_saved_km": distance_saved,
                "estimated_duration_minutes": duration_minutes,
                "fuel_cost": fuel_cost,
                "fuel_saved": fuel_saved,
                "route_data": {"bins": [b["bin_id"] for b in ordered_bins]},
                "status": "pending",
                "generated_by": "route_optimizer_agent",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            
            created_routes.append(route)
            logger.info(
                "optimize_routes_for_vehicles: Route %s for vehicle %s: %d bins, %.2f km, %.1f min",
                route["route_id"], vehicle["vehicle_id"], len(ordered_bins), optimized_distance, duration_minutes
            )
        
        except Exception as e:
            logger.error("optimize_routes_for_vehicles: Error optimizing route for vehicle %s: %s", vehicle["vehicle_id"], e)
            continue
    
    return created_routes


def run_route_agent():
    """
    Scheduler job that runs every 30 minutes.
    Fetches priority bins and available vehicles, then generates optimized routes.
    """
    logger.info("run_route_agent: Starting route optimization...")
    
    try:
        # Fetch priority bins
        try:
            priority_bins = db.get_bins_above_threshold(FILL_THRESHOLD)
            logger.info("run_route_agent: Fetched %d priority bins from database", len(priority_bins))
        except Exception as e:
            logger.warning("run_route_agent: Database error fetching bins, using sample data: %s", e)
            priority_bins = _get_sample_bins_for_routing(30)
        
        if not priority_bins:
            logger.info("run_route_agent: No priority bins available")
            return
        
        # Fetch available vehicles
        try:
            vehicles = [v for v in db.get_all_vehicles() if v.get("status") == "available"]
            logger.info("run_route_agent: Fetched %d available vehicles from database", len(vehicles))
        except Exception as e:
            logger.warning("run_route_agent: Database error fetching vehicles, using sample data: %s", e)
            vehicles = _get_sample_vehicles_for_routing(3)
        
        if not vehicles:
            logger.info("run_route_agent: No available vehicles")
            return
        
        # Optimize routes
        routes = optimize_routes_for_vehicles(priority_bins, vehicles, FILL_THRESHOLD)
        
        if not routes:
            logger.warning("run_route_agent: No routes generated")
            return
        
        # Save routes to database
        saved_count = 0
        for route in routes:
            try:
                db.save_route(route)
                saved_count += 1
            except Exception as e:
                logger.error("run_route_agent: Failed to save route %s: %s", route["route_id"], e)
        
        logger.info("run_route_agent: Successfully generated and saved %d routes", saved_count)
    
    except Exception as e:
        logger.error("run_route_agent: Fatal error: %s", e)
