<script lang="ts">
  import { I, type IconName } from '../../lib/icons';
  let { name, size = 16, cls = '' }: { name: IconName; size?: number; cls?: string } = $props();
</script>
<span class="ic {cls}" style="width:{size}px;height:{size}px">{@html I[name]}</span>
