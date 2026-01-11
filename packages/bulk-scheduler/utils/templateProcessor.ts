export type SystemVariable = {
  key: string
  value: string
  description?: string
}

export type TemplateProcessorOptions = {
  variables: SystemVariable[]
  strict?: boolean
}

export type ProcessedTemplate = {
  content: string
  missingVariables: string[]
}

export const processTemplate = (
  template: string,
  options: TemplateProcessorOptions
): ProcessedTemplate => {
  const { variables, strict = false } = options
  let processedContent = template
  const missingVariables: string[] = []
  const foundVariables = new Set<string>()

  const variableMap = new Map(variables.map(v => [v.key, v.value]))

  const variablePattern = /\{\{([^}]+)\}\}/g
  const matches = Array.from(template.matchAll(variablePattern))

  for (const match of matches) {
    if (!match[1]) continue
    const variableKey = match[1].trim()

    if (!foundVariables.has(variableKey)) {
      foundVariables.add(variableKey)
      const replacement = variableMap.get(variableKey)

      if (replacement === undefined && !missingVariables.includes(variableKey)) {
        missingVariables.push(variableKey)
      }
    }

    const replacement = variableMap.get(variableKey)
    if (replacement !== undefined) {
      processedContent = processedContent.replace(match[0], replacement)
    }
  }

  if (strict && missingVariables.length > 0) {
    throw new Error(`Missing required variables: ${missingVariables.join(', ')}`)
  }

  return {
    content: processedContent,
    missingVariables
  }
}

export const extractVariablesFromTemplate = (template: string): string[] => {
  const variables: string[] = []
  const variablePattern = /\{\{([^}]+)\}\}/g
  let match

  while ((match = variablePattern.exec(template)) !== null) {
    const variableKey = match[1]?.trim() || ''
    if (!variables.includes(variableKey)) {
      variables.push(variableKey)
    }
  }

  return variables
}

export const getDefaultSystemVariables = (): SystemVariable[] => {
  return [
    {
      key: 'date',
      value: new Date().toLocaleDateString(),
      description: 'Current date'
    },
    {
      key: 'time',
      value: new Date().toLocaleTimeString(),
      description: 'Current time'
    },
    {
      key: 'day',
      value: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      description: 'Current day of week'
    },
    {
      key: 'month',
      value: new Date().toLocaleDateString('en-US', { month: 'long' }),
      description: 'Current month'
    },
    {
      key: 'year',
      value: new Date().getFullYear().toString(),
      description: 'Current year'
    }
  ]
}

export const validateVariableSyntax = (template: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = []
  const openBraces = (template.match(/\{\{/g) || []).length
  const closeBraces = (template.match(/\}\}/g) || []).length

  if (openBraces !== closeBraces) {
    errors.push('Mismatched variable braces {{ }}')
  }

  const invalidPattern = /\{\{[^}]*\{|}\{[^}]*\}\}/g
  if (invalidPattern.test(template)) {
    errors.push('Invalid variable syntax detected')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export const replaceVariablesInContent = (
  content: string,
  variables: Record<string, string>
): string => {
  let result = content

  Object.entries(variables).forEach(([key, value]) => {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
    result = result.replace(pattern, value)
  })

  return result
}
