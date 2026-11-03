import Content from './dialog-content.svelte';
import Description from './dialog-description.svelte';
import Overlay from './dialog-overlay.svelte';
import Title from './dialog-title.svelte';
import { Dialog as DialogPrimitive } from 'bits-ui';

const Root = DialogPrimitive.Root;
const Trigger = DialogPrimitive.Trigger;

export {
  Root,
  Trigger,
  Overlay,
  Content,
  Title,
  Description,
  //
  Root as Dialog,
  Trigger as DialogTrigger,
  Overlay as DialogOverlay,
  Content as DialogContent,
  Title as DialogTitle,
  Description as DialogDescription,
};
