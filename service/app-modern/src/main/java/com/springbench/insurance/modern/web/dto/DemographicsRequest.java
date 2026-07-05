package com.springbench.insurance.modern.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class DemographicsRequest {
    @NotBlank
    @Size(max = 100)
    private String fname;
    @NotBlank
    @Size(max = 100)
    private String lname;
    @NotBlank
    @Email
    @Size(max = 254)
    private String email;
    @NotBlank
    @Size(max = 32)
    private String phoneNumber;
    @NotBlank
    private String status;

    public String getFname() {
        return fname;
    }

    public void setFname(String fname) {
        this.fname = fname;
    }

    public String getLname() {
        return lname;
    }

    public void setLname(String lname) {
        this.lname = lname;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
