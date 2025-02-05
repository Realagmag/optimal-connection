from .models import Node, Connection
from geopy import distance


class AStarOptimalPathSolver():
    def set_channel_percent(self, channel_size):
        self.ONE_CHANNEL_PERCENT = channel_size/4800*100

    def end_blocked(self):
        for conn_id in self.FINAL_PATHS:
            if self.used_capacity[conn_id] <= 100 - self.ONE_CHANNEL_PERCENT:
                return False
        return True

    def calculate_q(self, path: tuple[int]):
        value = 0
        conn_ids = list(path)
        for conn_id in conn_ids:
            if self.used_capacity[conn_id] > 100 - self.ONE_CHANNEL_PERCENT:
                value = float('inf')
                return value
            value += self.LENGTHS[conn_id] + self.calculate_penalty(conn_id)
        value += self.DIST_TO_END[path[-1]]
        return value

    def calculate_penalty(self, conn_id):
        usage = self.used_capacity[conn_id]
        if usage < 50:
            return 0
        if usage < 90:
            return (usage-50)*3
        return self.LENGTHS_SUM

    def translate_to_channel(self, speed):
        match speed:
            case 40:
                return 25
            case 100:
                return 50
            case 200:
                return 75
            case 400:
                return 112.5
            case _:
                return None

    def solve(self, start_node_id: int, end_node_id: int, speed: int):
        self.load_data(start_node_id, end_node_id)
        channel_size = self.translate_to_channel(speed)
        self.set_channel_percent(channel_size)
        if not channel_size or self.end_blocked():
            return None

        queue = {
            (conn.id,): self.calculate_q((conn.id,))
            for conn in self.starting_conns
        }

        best_paths = []

        while queue:
            path_to_expand = min(queue, key=queue.get)

            if queue[path_to_expand] == float('inf'):
                break

            if path_to_expand[-1] in self.FINAL_PATHS:
                best_paths.append((round(queue[path_to_expand],2), path_to_expand))
                if len(best_paths) == 2:
                    break

            del queue[path_to_expand]

            new_conns = self.continuations.get(path_to_expand[-1], [])
            for new_conn in new_conns:
                if self.not_repeated(new_conn, path_to_expand):
                    new_path = (*path_to_expand, new_conn)
                    new_path_value = self.calculate_q(new_path)
                    if new_path_value != float('inf'):
                        queue[new_path] = new_path_value

        if len(best_paths) < 2:
            return None  # Jeśli nie znaleziono dwóch rozwiązań, zwracamy None

        # Sortowanie dwóch najlepszych rozwiązań według wartości funkcji kosztu
        best_paths.sort()

        # Wypisywanie wartości kosztów i ścieżek
        for i, (cost, path) in enumerate(best_paths, 1):
            print(f"Rozwiązanie {i}: Koszt = {cost}, Ścieżka = {path}")

        return best_paths


    def not_repeated(self, conn, path):
        return conn not in path and self.ANTI_PATHS[conn] not in path

    def load_data(self, start_node_id, end_node_id):
        self.start_node: Node = Node.objects.get(id=start_node_id)
        self.end_node: Node = Node.objects.get(id=end_node_id)
        self.DIST_TO_END = {
            conn.id: distance.distance(
                (float(self.end_node.latitude),
                 float(self.end_node.longitude)),
                (float(conn.ending_node.latitude),
                 float(conn.ending_node.longitude))).km
            for conn in Connection.objects.all()
        }
        self.LENGTHS = {
            conn.id: distance.distance(
                (float(conn.starting_node.latitude),
                 float(conn.starting_node.longitude)),
                (float(conn.ending_node.latitude),
                 float(conn.ending_node.longitude))).km
            for conn in Connection.objects.all()
        }
        self.LENGTHS_SUM = sum(self.LENGTHS.values())
        self.FINAL_PATHS = [conn.id for conn in
                            Connection.objects.filter(
                                ending_node=self.end_node
                            )]
        self.ANTI_PATHS = {
            conn.id: Connection.objects.filter(
                starting_node=conn.ending_node,
                ending_node=conn.starting_node)[0].id
            for conn in Connection.objects.all()
        }
        self.used_capacity = {
            conn.id: float(conn.provisioned_capacity)
            for conn in Connection.objects.all()
        }
        self.starting_conns = Connection.objects.filter(starting_node=self.start_node)
        self.continuations = {
            conn.id: [
                later_conn.id for later_conn in Connection.objects.filter(
                    starting_node=conn.ending_node
                )
            ]
            for conn in Connection.objects.all()
        }
