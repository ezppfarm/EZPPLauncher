<script lang="ts">
  import { Dialog as DialogPrimitive, type WithoutChildrenOrChild } from 'bits-ui';

  let {
    open = $bindable(false),
    ...restProps
  }: WithoutChildrenOrChild<DialogPrimitive.RootProps> = $props();
</script>

<DialogPrimitive.Root bind:open {...restProps} />
