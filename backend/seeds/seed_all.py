import subprocess
import sys

print("🔄 Resetting database...")
subprocess.run([sys.executable, "reset_db.py"], check=True)

print("🧱 Creating tables...")
subprocess.run([sys.executable, "create_db.py"], check=True)

print("🌱 Seeding months...")
subprocess.run([sys.executable, "seed_months.py"], check=True)

print("🌱 Seeding investments...")
subprocess.run([sys.executable, "seed_investments.py"], check=True)

print("🌱 Seeding house and land costs...")
subprocess.run([sys.executable, "seed_house_land.py"], check=True)

print("🌱 Seeding planned purchases...")
subprocess.run([sys.executable, "seed_planned_purchases.py"], check=True)

print("🌱 Seeding meta values...")
subprocess.run([sys.executable, "seed_acc_info.py"], check=True)

print("🌱 Seeding cars...")
subprocess.run([sys.executable, "seed_cars.py"], check=True)

print("✅ All data seeded successfully.")
