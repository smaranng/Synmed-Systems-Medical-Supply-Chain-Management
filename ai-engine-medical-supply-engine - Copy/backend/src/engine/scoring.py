from .filters import distance


class ScoringEngine:
    def __init__(self, weights, audit_logger):
        self.weights = weights
        self.criteria = []
        self.audit = audit_logger

    def add_criteria(self, func):
        self.criteria.append(func)

    def score(self, distributor, context, order):
        total = 0
        breakdown = {}

        for func in self.criteria:
            name, value = func(distributor, context, order)
            weight = self.weights.get(name, 0)
            contribution = weight * value

            breakdown[name] = {
                "raw": round(value, 4),
                "weight": weight,
                "contribution": round(contribution, 4),
            }

            total += contribution

        self.audit.log(
            f"[SCORE] {distributor['name']} -> {round(total, 4)} | {breakdown}"
        )

        return total


def distance_score(distributor, context, order):
    dist = distance(distributor["location"], context["location"])
    return ("distance", 1 / (dist + 1))


def lead_time_score(distributor, context, order):
    return ("lead_time", 1 / (distributor["lead_days"] + 1))


def rating_score(distributor, context, order):
    return ("rating", distributor["rating"] / 5)


def price_score(distributor, context, order):
    return ("price", 1 / (distributor["price_per_unit"] + 1))
