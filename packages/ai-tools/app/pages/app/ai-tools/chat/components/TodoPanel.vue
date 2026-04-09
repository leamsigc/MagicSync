<template>
  <div class="todo-panel">
    <div class="panel-header">
      <h3 class="panel-title">{{ t('todos') }}</h3>
      <span class="todo-count">{{ completedCount }}/{{ todos.length }}</span>
    </div>
    <div class="todo-list">
      <div
        v-for="(todo, index) in todos"
        :key="todo.id || index"
        class="todo-item"
        :class="{ completed: todo.status === 'completed', in_progress: todo.status === 'in_progress' }"
      >
        <input
          type="checkbox"
          :checked="todo.status === 'completed'"
          @change="toggleTodo(index)"
          class="todo-checkbox"
        />
        <span class="todo-content">{{ todo.content }}</span>
      </div>
    </div>
    <div v-if="!todos.length" class="empty-state">
      {{ t('noTodos') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Todo {
  id?: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  order?: number
}

const props = defineProps<{
  initialTodos?: Todo[]
}>()

const emit = defineEmits<{
  (e: 'update', todos: Todo[]): void
}>()

const todos = ref<Todo[]>(props.initialTodos || [])

const completedCount = computed(() => {
  return todos.value.filter(t => t.status === 'completed').length
})

function toggleTodo(index: number) {
  const todo = todos.value[index]
  todo.status = todo.status === 'completed' ? 'pending' : 'completed'
  emit('update', todos.value)
}

function setTodos(newTodos: Todo[]) {
  todos.value = newTodos
}

function addTodo(content: string) {
  todos.value.push({
    content,
    status: 'pending',
    order: todos.value.length
  })
}

defineExpose({ setTodos, addTodos })
</script>

<style scoped>
.todo-panel {
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  padding: 0.75rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.panel-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.todo-count {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.375rem;
  border-radius: 0.25rem;
  transition: background 0.2s;
}

.todo-item:hover {
  background: var(--bg-tertiary);
}

.todo-item.completed .todo-content {
  text-decoration: line-through;
  color: var(--text-muted);
}

.todo-item.in_progress {
  background: rgba(234, 179, 8, 0.1);
  border-left: 2px solid #eab308;
}

.todo-checkbox {
  margin-top: 0.25rem;
  cursor: pointer;
}

.todo-content {
  font-size: 0.8125rem;
  color: var(--text-primary);
  line-height: 1.4;
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8125rem;
  padding: 1rem;
}
</style>
