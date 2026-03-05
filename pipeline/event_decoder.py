def decode_event(event) -> str:
    if isinstance(event, bytes):
        return event.decode('utf-8')
    return str(event)
