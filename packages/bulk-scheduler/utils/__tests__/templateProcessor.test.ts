import { describe, it, expect } from 'vitest'
import {
    processTemplate,
    extractVariablesFromTemplate,
    getDefaultSystemVariables,
    validateVariableSyntax,
    replaceVariablesInContent,
    type SystemVariable
} from '../templateProcessor'

describe('templateProcessor', () => {
    describe('extractVariablesFromTemplate', () => {
        it('should extract variables from template', () => {
            const template = 'Hello {{name}}, today is {{day}}'
            const variables = extractVariablesFromTemplate(template)
            expect(variables).toEqual(['name', 'day'])
        })

        it('should handle templates without variables', () => {
            const template = 'Hello world, no variables here'
            const variables = extractVariablesFromTemplate(template)
            expect(variables).toEqual([])
        })

        it('should handle duplicate variables', () => {
            const template = 'Hi {{name}}, welcome {{name}}'
            const variables = extractVariablesFromTemplate(template)
            expect(variables).toEqual(['name'])
        })

        it('should trim variable names', () => {
            const template = 'Hello {{ name }}'
            const variables = extractVariablesFromTemplate(template)
            expect(variables).toEqual(['name'])
        })
    })

    describe('processTemplate', () => {
        it('should replace variables in template', () => {
            const template = 'Hello {{name}}, today is {{day}}'
            const variables: SystemVariable[] = [
                { key: 'name', value: 'John' },
                { key: 'day', value: 'Monday' }
            ]

            const result = processTemplate(template, { variables })
            expect(result.content).toBe('Hello John, today is Monday')
            expect(result.missingVariables).toHaveLength(0)
        })

        it('should handle missing variables in non-strict mode', () => {
            const template = 'Hello {{name}}, today is {{day}}'
            const variables: SystemVariable[] = [
                { key: 'name', value: 'John' }
            ]

            const result = processTemplate(template, { variables, strict: false })
            expect(result.content).toContain('John')
            expect(result.missingVariables).toContain('day')
        })

        it('should throw error for missing variables in strict mode', () => {
            const template = 'Hello {{name}}, today is {{day}}'
            const variables: SystemVariable[] = [
                { key: 'name', value: 'John' }
            ]

            expect(() => {
                processTemplate(template, { variables, strict: true })
            }).toThrow('Missing required variables')
        })

        it('should handle variables with spaces', () => {
            const template = 'Hello {{ name }}'
            const variables: SystemVariable[] = [
                { key: 'name', value: 'John' }
            ]

            const result = processTemplate(template, { variables })
            expect(result.content).toBe('Hello John')
        })

        it('should handle empty templates', () => {
            const result = processTemplate('', { variables: [] })
            expect(result.content).toBe('')
            expect(result.missingVariables).toHaveLength(0)
        })

        it('should handle very long template content', () => {
            const longText = 'a'.repeat(20000)
            const template = `Start {{name}} ${longText} {{end}}`
            const variables: SystemVariable[] = [
                { key: 'name', value: 'StartValue' },
                { key: 'end', value: 'EndValue' }
            ]

            const result = processTemplate(template, { variables })
            expect(result.content).toContain('StartValue')
            expect(result.content).toContain('EndValue')
            expect(result.content.length).toBeGreaterThan(20000)
        })

        it('should handle variables with special characters in values', () => {
            const template = 'Value: {{val}}'
            const variables: SystemVariable[] = [
                { key: 'val', value: '!@#$%^&*()_+{}|:"<>?' }
            ]

            const result = processTemplate(template, { variables })
            expect(result.content).toBe('Value: !@#$%^&*()_+{}|:"<>?')
        })
    })

    describe('validateVariableSyntax', () => {
        it('should validate correct syntax', () => {
            const template = 'Hello {{name}}, today is {{day}}'
            const result = validateVariableSyntax(template)
            expect(result.valid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })

        it('should detect mismatched braces', () => {
            const template = 'Hello {{name}, today is {{day}}'
            const result = validateVariableSyntax(template)
            expect(result.valid).toBe(false)
            expect(result.errors[0]).toContain('Mismatched')
        })

        it('should detect unclosed brace at the end', () => {
            const template = 'Hello {{name'
            const result = validateVariableSyntax(template)
            expect(result.valid).toBe(false)
        })

        it('should handle templates without variables', () => {
            const template = 'Hello world'
            const result = validateVariableSyntax(template)
            expect(result.valid).toBe(true)
        })
    })

    describe('getDefaultSystemVariables', () => {
        it('should return default system variables', () => {
            const variables = getDefaultSystemVariables()
            expect(variables.length).toBeGreaterThan(0)
            expect(variables.some(v => v.key === 'date')).toBe(true)
            expect(variables.some(v => v.key === 'time')).toBe(true)
        })
    })

    describe('replaceVariablesInContent', () => {
        it('should replace variables in content', () => {
            const content = 'Hello {{name}}, welcome to {{place}}'
            const variables = {
                name: 'John',
                place: 'Paris'
            }

            const result = replaceVariablesInContent(content, variables)
            expect(result).toBe('Hello John, welcome to Paris')
        })

        it('should handle missing variables gracefully', () => {
            const content = 'Hello {{name}}'
            const variables = {}

            const result = replaceVariablesInContent(content, variables)
            expect(result).toBe('Hello {{name}}')
        })
    })
})
