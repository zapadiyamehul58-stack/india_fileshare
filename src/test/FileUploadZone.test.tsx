import { render } from '@testing-library/react';
import FileUploadZone from '../components/FileUploadZone';
import { expect, test, vi } from 'vitest';
import React from 'react';

test('FileUploadZone renders without crashing', () => {
    const onFilesSelected = vi.fn();
    render(
        <FileUploadZone
            onFilesSelected={onFilesSelected}
            isUploading={false}
            progress={0}
        />
    );
});
