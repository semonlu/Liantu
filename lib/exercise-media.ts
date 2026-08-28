import records from '@/Training-Nutrition-KB/exercise-media.json';

export type ExerciseMedia = {
  image?: string;
  video?: string;
  author: string;
  license: string;
  licenseUrl: string;
  description: string;
  source: 'wger' | 'ai';
};

type MediaRecord = {
  exerciseId: string;
  status: string;
  localPath?: string;
  author?: string;
  license?: string;
  licenseUrl?: string;
};

export const exerciseMedia: Record<string, ExerciseMedia> = Object.fromEntries(
  (records as MediaRecord[])
    .filter((item) => item.localPath && ['downloaded', 'generated'].includes(item.status))
    .map((item) => [item.exerciseId, {
      image: item.localPath,
      author: item.author || 'wger community',
      license: item.license || '',
      licenseUrl: item.licenseUrl || '',
      description: '',
      source: item.status === 'generated' ? 'ai' : 'wger',
    }]),
);
