<script lang="ts" setup>



interface PathPoint {
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
}

interface ClipperOptions {
  ClipRect: {};
  ClipRRect: { borderRadius: number };
  ClipOval: {};
  ClipPath: { pathPoints: PathPoint[]; borderRadius: number }; // Added borderRadius
  ShapeBorderClipper: { shape: string; borderRadius: number };
}

/**
 *
 * Component Description:Visual editor to create Flutter Clipper code.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const clipperTypes = [
  { label: 'ClipRect', value: 'ClipRect' },
  { label: 'ClipRRect', value: 'ClipRRect' },
  { label: 'ClipOval', value: 'ClipOval' },
  { label: 'ClipPath', value: 'ClipPath' },
  { label: 'ShapeBorderClipper', value: 'ShapeBorderClipper' },
];

const selectedClipperType: Ref<keyof ClipperOptions> = ref('ClipRect');

const currentClipperOptions: Ref<ClipperOptions> = ref({
  ClipRect: {},
  ClipRRect: { borderRadius: 0 },
  ClipOval: {},
  ClipPath: {
    pathPoints: [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 0 },
    ],
    borderRadius: 0, // Initial borderRadius for ClipPath
  },
  ShapeBorderClipper: { shape: 'RoundedRectangleBorder', borderRadius: 0 },
});

const generatedCode = computed(() => {
  const type = selectedClipperType.value;
  let code = '';

  switch (type) {
    case 'ClipRect':
      code = `ClipRect(
  child: Container(
    width: 200,
    height: 100,
    color: Colors.blue,
    child: const Text('Clipped Rect'),
  ),
)`;
      break;
    case 'ClipRRect':
      const rRectOptions = currentClipperOptions.value.ClipRRect;
      code = `ClipRRect(
  borderRadius: BorderRadius.circular(${rRectOptions.borderRadius}),
  child: Container(
    width: 200,
    height: 100,
    color: Colors.green,
    child: const Text('Clipped RRect'),
  ),
)`;
      break;
    case 'ClipOval':
      code = `ClipOval(
  child: Container(
    width: 200,
    height: 100,
    color: Colors.red,
    child: const Text('Clipped Oval'),
  ),
)`;
      break;
    case 'ClipPath':
      const pathOptions = currentClipperOptions.value.ClipPath;
      const flutterPathPoints = pathOptions.pathPoints
        .map((p) => `path.lineTo(size.width * ${p.x / 100}, size.height * ${p.y / 100});`)
        .join('\n    ');
      const clipPathBorderRadius = pathOptions.borderRadius;

      code = `class MyCustomClipper extends CustomClipper<Path> {
  final double borderRadius;

  MyCustomClipper({this.borderRadius = 0});

  @override
  Path getClip(Size size) {
    var path = Path();
    ${flutterPathPoints}
    path.close();

    if (borderRadius > 0) {
      return Path.combine(
        PathOperation.intersect,
        path,
        Path()..addRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, size.width, size.height), Radius.circular(borderRadius))),
      );
    }

    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) {
    return false; // Or implement more complex reclip logic
  }
}

ClipPath(
  clipper: MyCustomClipper(borderRadius: ${clipPathBorderRadius}),
  child: Container(
    width: 200,
    height: 100,
    color: Colors.purple,
    child: const Text('Clipped Path'),
  ),
)`;
      break;
    case 'ShapeBorderClipper':
      const shapeBorderOptions = currentClipperOptions.value.ShapeBorderClipper;
      let shapeCode = '';
      if (shapeBorderOptions.shape === 'RoundedRectangleBorder') {
        shapeCode = `RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(${shapeBorderOptions.borderRadius}),
  )`;
      } else if (shapeBorderOptions.shape === 'BeveledRectangleBorder') {
        shapeCode = `BeveledRectangleBorder(
    borderRadius: BorderRadius.circular(${shapeBorderOptions.borderRadius}),
  )`;
      }
      code = `ClipPath(
  clipper: ShapeBorderClipper(
    shape: ${shapeCode},
  ),
  child: Container(
    width: 200,
    height: 100,
    color: Colors.orange,
    child: const Text('Clipped ShapeBorder'),
  ),
)`;
      break;
  }
  return code;
});

const getClipClass = computed(() => {
  const type = selectedClipperType.value;
  switch (type) {
    case 'ClipRect':
      return {};
    case 'ClipRRect':
      const rRectRadius = currentClipperOptions.value.ClipRRect.borderRadius;
      return rRectRadius > 0 ? { borderRadius: `${rRectRadius}px` } : {};
    case 'ClipOval':
      return { borderRadius: '9999px' }; // Tailwind's rounded-full
    case 'ClipPath':
      const pathPoints = currentClipperOptions.value.ClipPath.pathPoints;
      const clipPathBorderRadius = currentClipperOptions.value.ClipPath.borderRadius;
      const cssPath = pathPoints.map((p) => `${p.x}% ${p.y}%`).join(', ');
      return {
        clipPath: `polygon(${cssPath})`,
        borderRadius: clipPathBorderRadius > 0 ? `${clipPathBorderRadius}px` : '0px',
      };
    case 'ShapeBorderClipper':
      const shapeRadius = currentClipperOptions.value.ShapeBorderClipper.borderRadius;
      return shapeRadius > 0 ? { borderRadius: `${shapeRadius}px` } : {};
    default:
      return {};
  }
});

async function copyCode() {
  try {
    await navigator.clipboard.writeText(generatedCode.value);
    alert('Flutter code copied to clipboard!');
  } catch (err) {
    log.error({ message: 'Failed to copy', error: String(err) });
    alert('Failed to copy Flutter code.');
  }
}
</script>

<template>
  <UCard class="w-full max-w-4xl mx-auto my-8">
    <template #header>
      <h2 class="text-xl font-bold">Flutter Clipper Editor</h2>
    </template>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <!-- Controls Column -->
      <div class="space-y-4">
        <UFormField label="Clipper Type">
          <USelect v-model="selectedClipperType" :items="clipperTypes" />
        </UFormField>

        <!-- Dynamic Options based on selectedClipperType -->
        <div v-if="selectedClipperType === 'ClipRRect'">
          <UFormField label="Border Radius">
            <USlider v-model="currentClipperOptions.ClipRRect.borderRadius" :min="0" :max="100" />
          </UFormField>
        </div>

        <div v-if="selectedClipperType === 'ClipPath'">
          <h4 class="text-md font-semibold mt-4 mb-2">Path Points (X%, Y%)</h4>
          <div
v-for="(point, index) in currentClipperOptions.ClipPath.pathPoints" :key="index"
            class="flex flex-col space-y-2 mb-4 p-2 border border-gray-200 dark:border-gray-700 rounded-md">
            <div class="flex items-center justify-between">
              <h5 class="text-sm font-medium">Point {{ index + 1 }}</h5>
              <UButton
icon="i-heroicons-minus-circle" color="error" variant="ghost"
                @click="currentClipperOptions.ClipPath.pathPoints.splice(index, 1)" />
            </div>
            <UFormField label="X Coordinate (%)">
              <USlider v-model="point.x" :min="0" :max="100" />
            </UFormField>
            <UFormField label="Y Coordinate (%)">
              <USlider v-model="point.y" :min="0" :max="100" />
            </UFormField>
          </div>
          <UButton
icon="i-heroicons-plus-circle" color="success" variant="ghost" block
            @click="currentClipperOptions.ClipPath.pathPoints.push({ x: 50, y: 50 })">
            Add Path Point
          </UButton>

          <UFormField label="Border Radius" class="mt-4">
            <USlider v-model="currentClipperOptions.ClipPath.borderRadius" :min="0" :max="100" />
            <UInput v-model.number="currentClipperOptions.ClipPath.borderRadius" type="number" />
          </UFormField>
        </div>

        <div v-if="selectedClipperType === 'ShapeBorderClipper'">
          <UFormField label="Shape Border">
            <USelect
v-model="currentClipperOptions.ShapeBorderClipper.shape"
              :items="['RoundedRectangleBorder', 'BeveledRectangleBorder']" />
          </UFormField>
          <UFormField label="Border Radius">
            <USlider v-model="currentClipperOptions.ShapeBorderClipper.borderRadius" :min="0" :max="100" />
          </UFormField>
        </div>

        <UButton icon="i-heroicons-clipboard-document" block @click="copyCode">
          Copy Flutter Code
        </UButton>
      </div>

      <!-- Preview Column -->
      <div class="space-y-4">
        <!-- Visual Preview -->
        <div>
          <h3 class="text-lg font-semibold mb-2">Visual Preview</h3>
          <div class="flex justify-center">
            <div
              class="w-48 h-32 bg-linear-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm relative overflow-hidden"
              :style="getClipClass">
              <div class="absolute inset-0 bg-linear-to-br from-blue-400 to-purple-500"/>
              <span class="relative z-10">Preview</span>
            </div>
          </div>
        </div>

        <h3 class="text-lg font-semibold">Generated Flutter Code</h3>
        <Card>
          <section>
            <code lang="ts" class="whitespace-pre-wrap text-sm font-mono">
          {{ generatedCode }}
        </code>
          </section>
        </Card>
      </div>
    </div>
  </UCard>
</template>

<style scoped></style>
