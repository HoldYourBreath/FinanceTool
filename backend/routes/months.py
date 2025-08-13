from flask import Blueprint, jsonify
from models.models import db, Month, Financing

months_bp = Blueprint('months', __name__)

def build_months_data(months, financing_data, is_past=False):
    result = []
    prev_ending_funds = None
    prev_loan_remaining = None

    for idx, month in enumerate(months):
        total_income = sum(float(i.amount) for i in month.incomes)
        total_expenses = sum(float(e.amount) for e in month.expenses)
        surplus = total_income - total_expenses

        starting_funds = float(month.starting_funds or 0.0) if idx == 0 else prev_ending_funds
        loan_remaining = financing_data.get('loans_taken', float(month.loan_remaining or 0.0)) if idx == 0 else prev_loan_remaining

        ending_funds = starting_funds + surplus
        loan_adjustment_delta = sum(
            float(adj.amount) if adj.type == "disbursement" else -float(adj.amount)
            for adj in month.loan_adjustments
            if adj.type in ("disbursement", "payment")
        )
        loan_remaining += loan_adjustment_delta

        if not is_past:
            updated = False
            if idx != 0:
                if month.starting_funds != starting_funds:
                    month.starting_funds = starting_funds
                    updated = True
                if month.loan_remaining != loan_remaining:
                    month.loan_remaining = loan_remaining
                    updated = True

            if month.ending_funds != ending_funds:
                month.ending_funds = ending_funds
                updated = True
            if month.surplus != surplus:
                month.surplus = surplus
                updated = True

            if updated:
                db.session.add(month)

        result.append({
            "id": month.id,
            "name": month.name,
            "month_date": month.month_date.isoformat() if month.month_date else None,
            "startingFunds": starting_funds,
            "endingFunds": ending_funds,
            "surplus": surplus,
            "loanRemaining": loan_remaining,
            "is_current": month.is_current,
            "incomes": [{"name": i.source, "amount": float(i.amount)} for i in month.incomes],
            "expenses": [{"description": e.description, "amount": float(e.amount)} for e in month.expenses],
            "loanAdjustments": [
                {"name": l.name, "type": l.type, "amount": float(l.amount), "note": l.note}
                for l in month.loan_adjustments
            ],
        })

        prev_ending_funds = ending_funds
        prev_loan_remaining = loan_remaining

    if not is_past:
        db.session.commit()

    return result

@months_bp.route('/api/months')
def get_months():
    months = Month.query.order_by(Month.month_date).all()
    financing_entries = Financing.query.all()
    financing_data = {f.name: float(f.value) for f in financing_entries}

    all_months_data = build_months_data(months, financing_data, is_past=False)

    # Find index of first month where is_current is True
    current_index = next((i for i, m in enumerate(all_months_data) if m['is_current']), 0)
    print(f'Current Month Index: {current_index}')

    # Return months from current (inclusive) onwards
    future_months_data = all_months_data[current_index:]
    return jsonify(future_months_data)


@months_bp.route('/api/months/all')
def get_all_months():
    months = Month.query.order_by(Month.month_date).all()
    financing_entries = Financing.query.all()
    financing_data = {f.name: float(f.value) for f in financing_entries}

    all_months_data = build_months_data(months, financing_data, is_past=True)
    return jsonify(all_months_data)






