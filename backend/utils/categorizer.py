import json
import os

CATEGORY_MAP_FILE = os.path.join(os.path.dirname(__file__), '../data/category_map.json')

with open(CATEGORY_MAP_FILE, encoding='utf-8') as f:
    CATEGORY_MAP = json.load(f)


def categorize_description(description):
    """
    Categorize the description based on loaded CATEGORY_MAP
    """
    desc_lower = description.lower()

    for category, keywords in CATEGORY_MAP.items():
        for keyword in keywords:
            if keyword.lower() in desc_lower:
                return category
    return 'Other'
