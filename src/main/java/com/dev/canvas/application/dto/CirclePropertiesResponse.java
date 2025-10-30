package com.dev.canvas.application.dto;

import java.math.BigDecimal;

public record CirclePropertiesResponse(BigDecimal centerX, BigDecimal centerY, BigDecimal radius, String strokeColor, String fillColor) {
}

