import { config, fields, collection, singleton } from '@keystatic/core';

/**
 * Admin panel (Keystatic) configuration.
 * Open /keystatic on the site to edit content.
 *
 * Storage:
 *  - local dev: files are edited directly on disk
 *  - production: set PUBLIC_KEYSTATIC_CLOUD_PROJECT (Keystatic Cloud, easiest)
 *    or the KEYSTATIC_GITHUB_* env vars (GitHub mode). Every save becomes a commit.
 */
const cloudProject = import.meta.env.PUBLIC_KEYSTATIC_CLOUD_PROJECT as string | undefined;
const githubRepo = (import.meta.env.PUBLIC_KEYSTATIC_GITHUB_REPO as string | undefined) || 'Bloginya/daryakruk-site';

const storage = import.meta.env.DEV
  ? ({ kind: 'local' } as const)
  : cloudProject
    ? ({ kind: 'cloud' } as const)
    : ({ kind: 'github', repo: githubRepo as `${string}/${string}` } as const);

const TEXT_HINT =
  'Formatting: **bold**, _italic_, ((text)) = drawn oval outline, new line = line break, empty line = new paragraph.';

const background = fields.select({
  label: 'Background',
  options: [
    { label: 'Black', value: 'black' },
    { label: 'Pink', value: 'pink' },
    { label: 'White', value: 'white' },
  ],
  defaultValue: 'black',
});

const projectImage = (label: string, description?: string) =>
  fields.image({
    label,
    description,
    directory: 'src/assets/images/projects',
    publicPath: '/src/assets/images/projects/',
  });

const projectVideo = (label: string) =>
  fields.file({
    label,
    description: 'MP4 video. Keep it under ~50 MB (export at 1080p).',
    directory: 'public/videos',
    publicPath: '/videos/',
  });

const imageList = (label: string) =>
  fields.array(
    fields.object({
      image: projectImage('Image'),
      alt: fields.text({ label: 'Alt text (for accessibility & SEO)' }),
    }),
    { label, itemLabel: (p) => p.fields.alt.value || 'Image' },
  );

/** Building blocks for project (case study) pages. */
const projectBlocks = fields.blocks(
  {
    hero: {
      label: 'Hero / Title',
      schema: fields.object({
        background,
        backgroundImage: projectImage('Background image (optional)'),
        eyebrow: fields.text({ label: 'Small text above title', description: 'e.g. Coca-Cola' }),
        title: fields.text({ label: 'Title', multiline: true, description: TEXT_HINT }),
        subtitle: fields.text({ label: 'Subtitle', multiline: true, description: TEXT_HINT }),
        align: fields.select({
          label: 'Alignment',
          options: [
            { label: 'Center', value: 'center' },
            { label: 'Left (bottom)', value: 'left' },
          ],
          defaultValue: 'center',
        }),
      }),
    },
    video: {
      label: 'Video',
      schema: fields.object({
        background,
        video: projectVideo('Video file'),
        poster: projectImage('Poster image (shown before play)'),
        caption: fields.text({ label: 'Caption' }),
        size: fields.select({
          label: 'Width',
          options: [
            { label: 'Full width', value: 'full' },
            { label: 'Medium', value: 'medium' },
          ],
          defaultValue: 'full',
        }),
        autoplay: fields.checkbox({
          label: 'Autoplay silently in a loop',
          description: 'Good for short clips. Long videos should show a play button.',
          defaultValue: false,
        }),
      }),
    },
    text: {
      label: 'Text',
      schema: fields.object({
        background,
        heading: fields.text({ label: 'Heading', multiline: true, description: TEXT_HINT }),
        body: fields.text({ label: 'Text', multiline: true, description: TEXT_HINT }),
        size: fields.select({
          label: 'Text style',
          options: [
            { label: 'Normal', value: 'normal' },
            { label: 'Big statement', value: 'statement' },
          ],
          defaultValue: 'normal',
        }),
        align: fields.select({
          label: 'Alignment',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
          ],
          defaultValue: 'left',
        }),
      }),
    },
    marquee: {
      label: 'Running line (marquee)',
      schema: fields.object({
        background,
        items: fields.array(fields.text({ label: 'Text' }), {
          label: 'Items',
          itemLabel: (p) => p.value,
        }),
        style: fields.select({
          label: 'Style',
          options: [
            { label: 'Small text', value: 'small' },
            { label: 'Big headline font', value: 'big' },
          ],
          defaultValue: 'small',
        }),
      }),
    },
    feature: {
      label: 'Step / Text + images',
      schema: fields.object({
        background,
        label: fields.text({ label: 'Label (italic, before the title)', description: 'e.g. step #1_' }),
        title: fields.text({ label: 'Title', multiline: true, description: TEXT_HINT }),
        body: fields.text({ label: 'Text', multiline: true, description: TEXT_HINT }),
        images: imageList('Images'),
        video: projectVideo('Small looping video (optional)'),
        mediaPosition: fields.select({
          label: 'Images position',
          options: [
            { label: 'Right', value: 'right' },
            { label: 'Left', value: 'left' },
          ],
          defaultValue: 'right',
        }),
        layout: fields.select({
          label: 'Images layout',
          options: [
            { label: 'Collage (first image big)', value: 'collage' },
            { label: 'Even grid', value: 'grid' },
          ],
          defaultValue: 'collage',
        }),
      }),
    },
    gallery: {
      label: 'Gallery',
      schema: fields.object({
        background,
        heading: fields.text({ label: 'Heading (optional)', description: TEXT_HINT }),
        images: imageList('Images'),
        style: fields.select({
          label: 'Style',
          options: [
            { label: 'Grid', value: 'grid' },
            { label: 'Masonry (Pinterest style)', value: 'masonry' },
            { label: 'Full-width stack', value: 'stack' },
            { label: 'Carousel (swipe)', value: 'carousel' },
            { label: 'Editorial (one big + small ones)', value: 'editorial' },
          ],
          defaultValue: 'grid',
        }),
      }),
    },
    image: {
      label: 'Single image',
      schema: fields.object({
        background,
        image: projectImage('Image'),
        alt: fields.text({ label: 'Alt text' }),
        caption: fields.text({ label: 'Caption' }),
        size: fields.select({
          label: 'Width',
          options: [
            { label: 'Full width (with margins)', value: 'wide' },
            { label: 'Medium', value: 'medium' },
            { label: 'Edge to edge', value: 'bleed' },
          ],
          defaultValue: 'wide',
        }),
      }),
    },
    collage: {
      label: 'Statement + floating images',
      schema: fields.object({
        background,
        backgroundImage: projectImage('Background texture (optional)'),
        text: fields.text({ label: 'Big statement', multiline: true, description: TEXT_HINT }),
        images: imageList('Floating images (up to 7)'),
      }),
    },
    details: {
      label: 'Project details (deliverables, scope…)',
      schema: fields.object({
        background,
        intro: fields.text({ label: 'Text (left column)', multiline: true, description: TEXT_HINT }),
        items: fields.array(
          fields.object({
            label: fields.text({ label: 'Label', description: 'e.g. Deliverables' }),
            text: fields.text({ label: 'Text', multiline: true }),
          }),
          { label: 'Details', itemLabel: (p) => p.fields.label.value },
        ),
      }),
    },
  },
  { label: 'Page sections' },
);

export default config({
  storage,
  ...(cloudProject ? { cloud: { project: cloudProject } } : {}),
  ui: {
    brand: { name: 'Darya Kruk — admin' },
    navigation: {
      Pages: ['home', 'projects'],
      Settings: ['settings'],
    },
  },
  singletons: {
    settings: singleton({
      label: 'Site settings',
      path: 'src/content/settings',
      format: { data: 'json' },
      schema: {
        siteTitle: fields.text({ label: 'Site title (browser tab)' }),
        description: fields.text({ label: 'SEO description', multiline: true }),
        email: fields.text({ label: 'Contact e-mail', description: 'Shown as a fallback link under the form.' }),
        formAccessKey: fields.text({
          label: 'Contact form key (Web3Forms)',
          description: 'Free key from web3forms.com — messages from the form are delivered to your e-mail.',
        }),
        behance: fields.url({ label: 'Behance URL' }),
        linkedin: fields.url({ label: 'LinkedIn URL' }),
        instagram: fields.url({ label: 'Instagram URL (optional)' }),
        headerCta: fields.text({ label: 'Header button text', defaultValue: 'Get Started' }),
        footerText: fields.text({ label: 'Footer text', defaultValue: 'Made by Darya Kruk' }),
        contactTitle: fields.text({ label: 'Contact section — title', defaultValue: 'Have questions?' }),
        contactTitleItalic: fields.text({ label: 'Contact section — italic line', defaultValue: 'Let’s chat.' }),
        contactText: fields.text({ label: 'Contact section — text', multiline: true }),
        ogImage: fields.image({
          label: 'Social share image (1200×630)',
          directory: 'src/assets/images/site',
          publicPath: '/src/assets/images/site/',
        }),
      },
    }),
    home: singleton({
      label: 'Home page',
      path: 'src/content/home',
      format: { data: 'json' },
      schema: {
        hero: fields.object(
          {
            image: fields.image({
              label: 'Hero image (3D logo)',
              directory: 'src/assets/images/home',
              publicPath: '/src/assets/images/home/',
            }),
            topLeft: fields.text({ label: 'Top left (big)', multiline: true }),
            topRight: fields.text({ label: 'Top right (small list)', multiline: true }),
            bottomLeft: fields.text({ label: 'Bottom left (small list)', multiline: true }),
            bottomRight: fields.text({ label: 'Bottom right (big)', multiline: true }),
            ctaLabel: fields.text({ label: 'Button text' }),
          },
          { label: 'Hero (first screen)' },
        ),
        services: fields.array(fields.text({ label: 'Service' }), {
          label: 'Services running line',
          itemLabel: (p) => p.value,
        }),
        about: fields.object(
          {
            kicker: fields.text({ label: 'Big line 1', defaultValue: 'Creative dsgnr' }),
            name: fields.text({ label: 'Big line 2 (italic)', defaultValue: 'Darya Kruk' }),
            photo: fields.image({
              label: 'Photo',
              directory: 'src/assets/images/home',
              publicPath: '/src/assets/images/home/',
            }),
            text: fields.text({ label: 'About text', multiline: true, description: TEXT_HINT }),
            tagline: fields.text({ label: 'Tagline (big italic)', multiline: true }),
          },
          { label: 'About me' },
        ),
        stats: fields.array(
          fields.object({
            value: fields.integer({ label: 'Number', description: 'Animated counter, e.g. 3000' }),
            suffix: fields.text({ label: 'After the number', description: 'e.g. + or M+' }),
            label: fields.text({ label: 'Caption' }),
          }),
          { label: 'Numbers (counters)', itemLabel: (p) => `${p.fields.value.value ?? ''}${p.fields.suffix.value} — ${p.fields.label.value}` },
        ),
        projectsTitle: fields.text({ label: '“Past projects” title', defaultValue: 'Past Projects' }),
        featured: fields.array(
          fields.object({
            project: fields.relationship({ label: 'Project', collection: 'projects' }),
            badge: fields.text({ label: 'Badge (italic, pink)', description: 'e.g. NEW' }),
            title: fields.text({ label: 'Title', multiline: true, description: TEXT_HINT }),
            tagline: fields.text({ label: 'Short description' }),
            image: fields.image({
              label: 'Image (leave empty to use the project cover)',
              directory: 'src/assets/images/home',
              publicPath: '/src/assets/images/home/',
            }),
          }),
          { label: 'Projects on the home page', itemLabel: (p) => p.fields.title.value || 'Project' },
        ),
        reelTitle: fields.text({ label: 'Visuals strip — title', defaultValue: 'Selected visuals' }),
        reel: fields.array(
          fields.object({
            image: fields.image({
              label: 'Image',
              directory: 'src/assets/images/home/reel',
              publicPath: '/src/assets/images/home/reel/',
            }),
            alt: fields.text({ label: 'Alt text' }),
          }),
          { label: 'Visuals strip (horizontal scroll)', itemLabel: (p) => p.fields.alt.value || 'Image' },
        ),
        testimonialsTitle: fields.text({ label: 'Testimonials title', defaultValue: 'Client testimonials' }),
        testimonials: fields.array(
          fields.object({
            quote: fields.text({ label: 'Quote', multiline: true }),
            name: fields.text({ label: 'Name' }),
            role: fields.text({ label: 'Role / company' }),
          }),
          { label: 'Testimonials', itemLabel: (p) => p.fields.name.value },
        ),
        clients: fields.array(fields.text({ label: 'Client' }), {
          label: 'Clients running line',
          itemLabel: (p) => p.value,
        }),
      },
    }),
  },
  collections: {
    projects: collection({
      label: 'Projects (portfolio)',
      slugField: 'name',
      path: 'src/content/projects/*',
      format: { data: 'json' },
      columns: ['name', 'order'],
      schema: {
        name: fields.slug({
          name: { label: 'Name in the portfolio list', description: 'e.g. The Fresco' },
          slug: { label: 'URL', description: 'daryakruk.ai/portfolio/<url>' },
        }),
        order: fields.integer({ label: 'Order in portfolio (1 = first)', defaultValue: 1 }),
        cover: projectImage('Cover image', 'Shown when hovering the project in the portfolio list.'),
        seoTitle: fields.text({ label: 'Browser tab title' }),
        seoDescription: fields.text({ label: 'SEO description', multiline: true }),
        sections: projectBlocks,
      },
    }),
  },
});
