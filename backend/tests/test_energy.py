# backend/tests/test_energy.py
from types import SimpleNamespace
import pytest

# Import the module object so we can patch attributes directly
import backend.utils.energy as energy

# Helper for money comparisons (optional)
def approx_money(x):
    return pytest.approx(x, rel=1e-6, abs=1e-6)

@pytest.fixture(autouse=True)
def stub_prices_and_km(monkeypatch):
    """
    Stub out get_prices() and get_yearly_km() inside backend.utils.energy
    so tests are deterministic. yearly_km=12000 => monthly_km=1000.
    """
    def fake_prices():
        return {
            "el_price_sek": 1.5,
            "bensin_price_sek_litre": 20.0,
            "diesel_price_sek_litre": 22.0,
            "daily_commute_km": 30.0,
        }
    # ✅ Patch via module object (no dotted string)
    monkeypatch.setattr(energy, "get_prices", fake_prices, raising=True)
    monkeypatch.setattr(energy, "get_yearly_km", lambda: 12_000.0, raising=True)

def test_ev_cost_simple():
    # monthly_km = 1000; 15 kWh/100km => 150 kWh; 1.5 SEK/kWh => 225 SEK
    car = SimpleNamespace(type_of_vehicle="EV", consumption_kwh_per_100km=15)
    assert energy.energy_cost_per_month(car) == approx_money(225.0)

def test_ev_accepts_string_numbers():
    car = SimpleNamespace(type_of_vehicle="EV", consumption_kwh_per_100km="15")
    assert energy.energy_cost_per_month(car) == approx_money(225.0)

def test_ice_petrol_cost():
    # 6.0 L/100km * 1000 km = 60 L; 20 SEK/L => 1200 SEK
    car = SimpleNamespace(type_of_vehicle="ICE", consumption_l_per_100km=6.0)
    assert energy.energy_cost_per_month(car) == approx_money(1200.0)

def test_ice_diesel_cost():
    # 5.0 L/100km * 1000 km = 50 L; 22 SEK/L => 1100 SEK
    car = SimpleNamespace(type_of_vehicle="DIESEL", consumption_l_per_100km=5.0)
    assert energy.energy_cost_per_month(car) == approx_money(1100.0)

def test_phev_with_computed_ev_range():
    # cons_kwh_100=17, batt=12 => ev_range ≈ 70.588 km
    # commute 30 km/day, 22 days => 660 km EV (<= monthly_km 1000)
    # kWh/km = 0.17 => 112.2 kWh => 168.3 SEK
    # fuel: l/100=6.5, fuel_km=340 => 22.1 L => 442 SEK
    car = SimpleNamespace(
        type_of_vehicle="PHEV",
        consumption_kwh_per_100km=17.0,
        battery_capacity_kwh=12.0,
        consumption_l_per_100km=6.5,
    )
    assert energy.energy_cost_per_month(car) == approx_money(168.3 + 442.0)

def test_phev_with_assumed_ev_range_when_specs_missing():
    # batt=0 forces assumed EV range (40 km), still covers 30 km/day commute
    car = SimpleNamespace(
        type_of_vehicle="PHEV",
        consumption_kwh_per_100km=17.0,
        battery_capacity_kwh=0.0,
        consumption_l_per_100km=6.5,
    )
    assert energy.energy_cost_per_month(car) == approx_money(610.3)

def test_phev_assumed_range_caps_ev_km(monkeypatch):
    # Override commute to 50 km/day; assumed EV range=40 => EV/day=40
    # EV_km_month = 40*22 = 880; fuel_km=120
    # kWh: 0.17*880=149.6 => 224.4 SEK; fuel: 6.5/100*120=7.8 L => 156 SEK
    monkeypatch.setattr(
        energy,
        "get_prices",
        lambda: {
            "el_price_sek": 1.5,
            "bensin_price_sek_litre": 20.0,
            "diesel_price_sek_litre": 22.0,
            "daily_commute_km": 50.0,
        },
        raising=True,
    )
    car = SimpleNamespace(
        type_of_vehicle="PHEV",
        consumption_kwh_per_100km=17.0,
        battery_capacity_kwh=0.0,
        consumption_l_per_100km=6.5,
    )
    assert energy.energy_cost_per_month(car) == approx_money(224.4 + 156.0)
