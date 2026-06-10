type JSONValue = (
    str | int | float | bool | list[JSONValue] | dict[str, JSONValue] | None
)
