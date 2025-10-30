package com.dev.canvas.application.dto;

import java.math.BigDecimal;

public record KeyframeResponse(BigDecimal timeSeconds, BigDecimal value, String easing) {
}

