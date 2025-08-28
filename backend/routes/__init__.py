# routes/__init__.py
from .health import health_bp
from .file_upload_routes import file_upload_bp
from .acc_info import acc_info_bp
from .car_evaluation import cars_bp
from .expenses import expenses_bp
from .financing import financing_bp
from .house import house_bp
from .incomes import incomes_bp
from .investments import investments_bp
from .loans import loans_bp
from .months import months_bp
from .planned_purchases import planned_purchases_bp
from .settings import settings_bp
from backend.routes.debug import debug_bp


def register_routes(app):
    app.register_blueprint(health_bp)
    app.register_blueprint(months_bp)
    app.register_blueprint(incomes_bp)
    app.register_blueprint(expenses_bp)
    app.register_blueprint(loans_bp)
    app.register_blueprint(house_bp)
    app.register_blueprint(acc_info_bp)
    app.register_blueprint(financing_bp)
    app.register_blueprint(investments_bp)
    app.register_blueprint(planned_purchases_bp)
    app.register_blueprint(file_upload_bp)
    app.register_blueprint(cars_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(debug_bp)

    print('Registered Routes:')
    for rule in app.url_map.iter_rules():
        print(rule)
