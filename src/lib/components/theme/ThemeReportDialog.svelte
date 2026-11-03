<script lang="ts">
  import {
    reportCommunityTheme,
    type CommunityTheme,
    type ThemeReportCategory,
  } from '$lib/communityThemes';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import Textarea from '$lib/components/ui/textarea/textarea.svelte';
  import { Flag, LoaderCircle, X } from '@lucide/svelte';
  import { sileo } from 'sileo';

  let {
    open = $bindable(false),
    theme,
  }: {
    open: boolean;
    theme: CommunityTheme | null;
  } = $props();

  const REPORT_CATEGORIES: Array<{ id: ThemeReportCategory; label: string }> = [
    { id: 'spam', label: 'Spam / advertising' },
    { id: 'harassment', label: 'Harassment / hate' },
    { id: 'malware', label: 'Malware / unsafe code' },
    { id: 'copyright', label: 'Copyright / stolen content' },
    { id: 'broken', label: 'Broken / unusable' },
    { id: 'other', label: 'Other' },
  ];

  let category = $state<ThemeReportCategory>('other');
  let details = $state('');
  let error = $state<string | null>(null);
  let submitting = $state(false);

  $effect(() => {
    if (!open || !theme) return;
    category = 'other';
    details = '';
    error = null;
  });

  async function submitReport() {
    const target = theme;
    if (!target || submitting) return;

    const reason = details.trim();
    if (reason.length < 10) {
      error = 'Please describe the problem in at least 10 characters.';
      return;
    }

    submitting = true;
    error = null;
    try {
      await reportCommunityTheme(target.id, reason.slice(0, 500), category);
      sileo.success({
        title: 'Report submitted',
        description: 'Thank you. A moderator will review the theme.',
      });
      open = false;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      submitting = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    class="flex w-[calc(100%_-_2rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-xl border-theme-800 bg-theme-950 p-0 text-white shadow-2xl sm:rounded-xl"
  >
    {#if theme}
      <div class="flex items-start justify-between gap-3 border-b border-theme-800/70 p-4">
        <div class="min-w-0">
          <Dialog.Title class="flex items-center gap-2 text-sm font-semibold text-white">
            <Flag class="size-4 text-amber-300" /> Report theme
          </Dialog.Title>
          <Dialog.Description class="mt-1 text-[11px] text-muted-foreground">
            Reporting <span class="text-white/80">{theme.name}</span> by {theme.author.name}.
            Reports are visible to moderators only.
          </Dialog.Description>
        </div>
        <Button
          variant="ghost"
          size="icon"
          class="size-7 shrink-0 text-muted-foreground hover:text-white"
          onclick={() => (open = false)}
          disabled={submitting}
          aria-label="Close report form"
        >
          <X class="size-4" />
        </Button>
      </div>

      <div class="space-y-3 p-4">
        <div class="space-y-1.5">
          <Label
            for="installed-report-category"
            class="text-[10px] uppercase tracking-wide text-white/70"
          >
            Category
          </Label>
          <Select.Root
            type="single"
            value={category}
            onValueChange={(value) => {
              if (value) category = value as ThemeReportCategory;
            }}
          >
            <Select.Trigger
              id="installed-report-category"
              class="h-8 border-theme-800 bg-theme-900/60 text-[11px] text-white"
            >
              {REPORT_CATEGORIES.find((item) => item.id === category)?.label ?? 'Other'}
            </Select.Trigger>
            <Select.Content class="border-theme-800 bg-theme-950">
              {#each REPORT_CATEGORIES as item (item.id)}
                <Select.Item value={item.id} label={item.label} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <div class="space-y-1.5">
          <Label
            for="installed-report-details"
            class="text-[10px] uppercase tracking-wide text-white/70"
          >
            Details
          </Label>
          <Textarea
            id="installed-report-details"
            class="min-h-28 resize-y border-theme-800 bg-theme-900/60 text-[11px] leading-relaxed text-white"
            rows={5}
            maxlength={500}
            placeholder="Describe what is wrong (at least 10 characters)..."
            bind:value={details}
            oninput={() => (error = null)}
            disabled={submitting}
          />
          <span class="block text-right text-[9px] text-muted-foreground">
            {details.trim().length}/500 · minimum 10
          </span>
        </div>

        {#if error}
          <p
            class="rounded-lg border border-red-900/40 bg-red-950/20 p-2.5 text-[11px] text-red-300"
          >
            {error}
          </p>
        {/if}
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-theme-800/70 p-3">
        <Button
          variant="ghost"
          size="sm"
          class="h-8 text-xs"
          onclick={() => (open = false)}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          class="h-8 gap-1 text-xs"
          onclick={() => void submitReport()}
          disabled={submitting}
        >
          {#if submitting}
            <LoaderCircle class="size-3 animate-spin" /> Sending...
          {:else}
            <Flag class="size-3" /> Submit report
          {/if}
        </Button>
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
