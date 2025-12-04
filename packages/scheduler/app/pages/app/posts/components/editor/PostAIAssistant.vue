<script lang="ts" setup>
/**
 * Component Description: AI Assistant dropdown menu and actions
 */

interface Props {
  loading?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits(['action']);

const aiActions = [
  [
    {
      label: 'Rewrite Professional',
      onSelect: () => emit('action', 'rewrite-professional')
    },
    {
      label: 'Rewrite Fun',
      onSelect: () => emit('action', 'rewrite-fun')
    },
    {
      label: 'Rewrite Concise',
      onSelect: () => emit('action', 'rewrite-concise')
    }
  ],
  [
    {
      label: 'Fix Grammar',
      icon: 'lucide:check-check',
      onSelect: () => emit('action', 'fix-grammar')
    },
    {
      label: 'Generate Hashtags',
      icon: 'lucide:hash',
      onSelect: () => emit('action', 'generate-hashtags')
    }
  ],
  [
    {
      label: 'Smart Split (Auto Thread)',
      icon: 'lucide:scissors',
      onSelect: () => emit('action', 'smart-split')
    }
  ]
];
</script>

<template>
  <UDropdownMenu :items="aiActions" :popper="{ placement: 'top-start' }">
    <UButton
      class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 transition-colors border border-indigo-500/20"
      icon="lucide:wand-2" :loading="loading" variant="ghost">
      <span class="text-sm font-medium">AI Tools</span>
    </UButton>
  </UDropdownMenu>
</template>
