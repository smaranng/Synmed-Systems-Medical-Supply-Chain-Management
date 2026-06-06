import math


def distance(loc1, loc2):
    return math.sqrt((loc1[0] - loc2[0]) ** 2 + (loc1[1] - loc2[1]) ** 2)


class FilterPipeline:
    def __init__(self, audit_logger):
        self.filters = []
        self.audit = audit_logger

    def add_filter(self, filter_func):
        self.filters.append(filter_func)

    def apply(self, distributors, context, order):
        for filter_func in self.filters:
            before = len(distributors)
            distributors = filter_func(distributors, context, order)
            after = len(distributors)

            self.audit.log(
                f"[FILTER] {filter_func.__name__}: {before} -> {after} distributors"
            )
        return distributors


def nearest_filter(distributors, context, order, radius=50):
    return [
        distributor
        for distributor in distributors
        if distance(distributor["location"], context["location"]) <= radius
    ]


def lead_time_filter(distributors, context, order):
    return [
        distributor
        for distributor in distributors
        if distributor["lead_days"] <= context["max_lead_days"]
    ]


def min_order_filter(distributors, context, order):
    valid = []

    for distributor in distributors:
        order_value = order["required_units"] * distributor["price_per_unit"]

        if order_value >= distributor["min_order_value"]:
            valid.append(distributor)
        else:
            print(f"[REJECTED] {distributor['name']} -> Below minimum order")

    return valid
