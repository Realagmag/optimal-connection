from . import models
from decimal import Decimal


def add_channel_to_db(route, channel_size):
    for conn_id in route:
        conn = models.Connection.objects.get(
            id=conn_id
        )
        models.Channel.objects.create(
            connection=conn,
            width=channel_size
        )
        reverse_conn = models.Connection.objects.get(
            starting_node=conn.ending_node,
            ending_node=conn.starting_node
        )
        models.Channel.objects.create(
            connection=reverse_conn,
            width=channel_size
        )
        add_capacity = Decimal(channel_size)/Decimal(4800)*Decimal(100)
        conn.provisioned_capacity += add_capacity
        conn.save()
        reverse_conn.provisioned_capacity += add_capacity
        reverse_conn.save()
