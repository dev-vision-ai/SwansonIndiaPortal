// Chart configuration utilities
// This file contains configuration settings and utilities for charts

// Default chart configuration
const defaultChartConfig = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'top',
        },
        title: {
            display: true,
            font: {
                size: 14,
                weight: 'bold'
            }
        }
    },
    scales: {
        y: {
            beginAtZero: true,
            ticks: {
                precision: 0
            }
        }
    }
};

// Quality inspection chart configurations
const qualityChartConfigs = {
    defectRate: {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Defect Rate (%)',
                data: [],
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.1
            }]
        },
        options: {
            ...defaultChartConfig,
            plugins: {
                ...defaultChartConfig.plugins,
                title: {
                    ...defaultChartConfig.plugins.title,
                    text: 'Defect Rate Trend'
                }
            }
        }
    },

    inspectionResults: {
        type: 'bar',
        data: {
            labels: ['Pass', 'Fail', 'Pending'],
            datasets: [{
                label: 'Inspection Results',
                data: [0, 0, 0],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(255, 206, 86, 0.6)'
                ],
                borderColor: [
                    'rgb(75, 192, 192)',
                    'rgb(255, 99, 132)',
                    'rgb(255, 206, 86)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            ...defaultChartConfig,
            plugins: {
                ...defaultChartConfig.plugins,
                title: {
                    ...defaultChartConfig.plugins.title,
                    text: 'Inspection Results Summary'
                }
            }
        }
    },

    line: {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            ...defaultChartConfig,
            plugins: {
                ...defaultChartConfig.plugins,
                title: {
                    ...defaultChartConfig.plugins.title,
                    text: 'Quality Trend'
                }
            }
        }
    },

    thicknessDistribution: {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Thickness Measurements',
                data: [],
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1
            }]
        },
        options: {
            ...defaultChartConfig,
            plugins: {
                ...defaultChartConfig.plugins,
                title: {
                    ...defaultChartConfig.plugins.title,
                    text: 'Thickness Distribution'
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Sample Position'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Thickness (mm)'
                    }
                }
            }
        }
    },

    basisWeightTrend: {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Basis Weight (GSM)',
                data: [],
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                tension: 0.1,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            ...defaultChartConfig,
            plugins: {
                ...defaultChartConfig.plugins,
                title: {
                    ...defaultChartConfig.plugins.title,
                    text: 'Basis Weight Trend'
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'GSM'
                    },
                    suggestedMin: 14,
                    suggestedMax: 18
                }
            }
        }
    },

    opacityTrend: {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Opacity (%)',
                data: [],
                borderColor: 'rgb(255, 206, 86)',
                backgroundColor: 'rgba(255, 206, 86, 0.2)',
                tension: 0.1,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            ...defaultChartConfig,
            plugins: {
                ...defaultChartConfig.plugins,
                title: {
                    ...defaultChartConfig.plugins.title,
                    text: 'Opacity Trend'
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Opacity (%)'
                    },
                    suggestedMin: 45,
                    suggestedMax: 55
                }
            }
        }
    },

    cofTrend: {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'COF Kinetic',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            ...defaultChartConfig,
            plugins: {
                ...defaultChartConfig.plugins,
                title: {
                    ...defaultChartConfig.plugins.title,
                    text: 'COF Kinetic Trend'
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'COF Value'
                    },
                    suggestedMin: 0.2,
                    suggestedMax: 0.6
                }
            }
        }
    }
};

// Utility function to create chart configuration
function createChartConfig(chartType, customOptions = {}) {
    const baseConfig = qualityChartConfigs[chartType];
    if (!baseConfig) {
        console.warn(`Chart type '${chartType}' not found. Using default line chart.`);
        return {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: { ...defaultChartConfig, ...customOptions }
        };
    }

    return {
        ...baseConfig,
        options: {
            ...baseConfig.options,
            ...customOptions
        }
    };
}

// Export configurations for use in other files
window.ChartConfig = {
    default: defaultChartConfig,
    quality: qualityChartConfigs,
    create: createChartConfig
};