export function interpolatePromptTemplate(
  template: string,
  values: Record<string, string | number>
) {
  return template.replace(/{{\s*([^{}\s]+)\s*}}/g, (token, key: string) => {
    const value = values[key]
    return value === undefined ? token : String(value)
  })
}
