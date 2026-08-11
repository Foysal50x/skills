<?php

declare(strict_types=1);

namespace App\Support\Filters;

/**
 * A lone value object with no preset family sits at the root of Filters/,
 * in its own file — PSR-4 resolves one type per file.
 */
enum Direction: string
{
    case Asc = 'asc';
    case Desc = 'desc';
}
